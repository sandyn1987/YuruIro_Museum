import * as THREE from 'three';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';
import { PointerLockControls } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/PointerLockControls.js';
import { artworkData } from './artworks.js';

/* =========================
   基本セットアップ
========================= */
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf2f2f2);

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);
camera.position.set(0, 1.6, 3);
// カメラの回転順序を 'YXZ' に設定（Y軸→X軸→Z軸）
camera.rotation.order = 'YXZ';
camera.rotation.y = Math.PI;  // Y軸（上下）回転：180°
camera.rotation.x = 0;        // X軸（前後）回転：0°
camera.rotation.z = 0;        // Z軸（ロール）回転：0°（禁止）

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// デバイス判定
const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent);

// 鑑賞モードの状態管理
let isViewing = false;
let currentArtwork = null;
const artworks = [];

let previousCameraPosition = new THREE.Vector3();
let previousCameraTarget = new THREE.Vector3();
// raycaster と pointer ベクター
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

const viewButton = document.getElementById('viewButton');
const closeButton = document.getElementById('closeButton');
closeButton.addEventListener('click', (event) => {
  event.stopPropagation();   // ← これ重要
  exitViewMode();
});

/* =========================
   ライト（美術館向け）
========================= */
// アートワーク用スポットライト設定
const artworkCount = 5;
const startPos = new THREE.Vector3(-4.0, 1.6, 4.8);
const spacingX = 2.0;
const spotHelpers = [];

function createArtworkSpotLight(scene, position) {
  console.log('createArtworkSpotLight called', position);
  console.log('scene =', scene);

  const spot = new THREE.SpotLight(0xfff1e0, 1.2);
  spot.position.set(
    position.x,
    position.y + 0.4, // 上
    position.z - 1.2  // 手前
  );

  spot.intensity = 5.0;
  spot.angle = Math.PI / 6;
  spot.penumbra = 0.4;
  spot.decay = 2;
  spot.distance = 10;
  spot.castShadow = true;
  spot.target.position.copy(position);

  scene.add(spot);

  // ヘルパー追加
  const helper = new THREE.SpotLightHelper(spot);
  // scene.add(helper);
  // spotHelpers.push(helper);
  // helper.update();

  return spot;
}
// 環境光
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);
// 天井光
const hemiLight = new THREE.HemisphereLight(
  0xffffff, // 空からの光
  0xdddddd, // 床からの反射
  0.8       // 強さ
);
scene.add(hemiLight);
console.log('scene =', scene);
// 各アートワーク用スポットライト
for (let i = 0; i < artworkCount; i++) {
  const artworkPos = new THREE.Vector3(
    startPos.x + i * spacingX,
    startPos.y,
    startPos.z
  );

  createArtworkSpotLight(scene, artworkPos);
}

/* =========================
   移動操作（FPS風・ゆっくり）
========================= */
let controls = null;
const keyState = {};

// PC操作
if (!isMobile) {
  controls = new PointerLockControls(camera, document.body);

  document.body.addEventListener('click', () => {
    if (isViewing) return;
    controls.lock();
  });

  document.addEventListener('keydown', e => keyState[e.code] = true);
  document.addEventListener('keyup', e => keyState[e.code] = false);
  
  window.addEventListener('pointermove', (event) => {
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
  });
  document.addEventListener('keydown', (e) => {
    keyState[e.code] = true;
    if (e.code === 'KeyX') {
      requestEnterViewMode();
    }
  });  
}
// カメラ回転
let yaw = Math.PI;  // 初期向き：180°
let pitch = 0;

function rotateCamera(deltaX, deltaY) {
  const ROTATE_SPEED = 0.002;

  yaw   -= deltaX * ROTATE_SPEED;
  pitch -= deltaY * ROTATE_SPEED;

  // 上下の見すぎ防止
  pitch = Math.max(
    -Math.PI / 2 + 0.01,
    Math.min(Math.PI / 2 - 0.01, pitch)
  );

  camera.rotation.y = yaw;
  camera.rotation.x = pitch;
  camera.rotation.z = 0; // ★ロール完全禁止
}

// 仮想ジョイスティック移動（モバイルのみ）
let moveX = 0;
let moveY = 0;
let joystickActive = false;
let startX = 0;
let startY = 0;
let isRotating = false;
let lastX = 0;
let lastY = 0;

if (isMobile) {
  const joystick = document.getElementById('joystick-area');
  const joystickBase = document.getElementById('joystick-base');
  const joystickStick = document.getElementById('joystick-stick');
  const JOYSTICK_RADIUS = 40;

  // 仮想ジョイスティック操作
  // タッチ開始
  joystick.addEventListener('pointerdown', (e) => {
    joystickActive = true;
    startX = e.clientX;
    startY = e.clientY;
    joystickBase.style.left = (startX - JOYSTICK_RADIUS) + 'px';
    joystickBase.style.top = (startY - JOYSTICK_RADIUS) + 'px';
    joystickBase.style.display = 'block';
  });
  // タッチ移動
  window.addEventListener('pointermove', (e) => {
    if (!joystickActive) return;

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    moveX = THREE.MathUtils.clamp(dx / 40, -1, 1);
    moveY = THREE.MathUtils.clamp(-dy / 40, -1, 1); // 符号反転：上へドラッグ = 前進

    // スティックの位置を更新
    joystickStick.style.left = (20 + dx * 0.5) + 'px';
    joystickStick.style.top = (20 + dy * 0.5) + 'px';
  });
  // タッチ終了
  window.addEventListener('pointerup', () => {
    joystickActive = false;
    moveX = 0;
    moveY = 0;
    joystickBase.style.display = 'none';
    joystickStick.style.left = '20px';
    joystickStick.style.top = '20px';
  });

  // モバイル：全画面タッチドラッグで視点回転
  // タッチ開始
  window.addEventListener('pointerdown', (e) => {
    if (joystickActive) return; // ジョイスティック使用中は無効
    // --- Raycast用座標更新 ---
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
    const hit = checkIntersections();
    if (hit) {
      // 作品に触れたなら回転開始しない
      requestEnterViewMode();
      return;
    }
    // 回転開始
    isRotating = true;
    lastX = e.clientX;
    lastY = e.clientY;
  });
  // タッチ移動
  window.addEventListener('pointermove', (e) => {
    if (!isRotating) return;

    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;

    rotateCamera(dx, dy);

    lastX = e.clientX;
    lastY = e.clientY;
  });
  // タッチ終了
  window.addEventListener('pointerup', () => {
    isRotating = false;
  });
}

// --------------------
// 移動ロジック共通
// --------------------
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
const speed = isMobile ? 0.03 : 0.06;

function updateMovement() {
  if (isMobile) {
    // moveX, moveY は仮想スティックから取得（-1〜1）
    if (moveX !== 0 || moveY !== 0) {

      // 前方向（XZ平面）
      const forward = new THREE.Vector3();
      camera.getWorldDirection(forward);
      forward.y = 0;
      forward.normalize();

      // 右方向
      const right = new THREE.Vector3();
      right.crossVectors(forward, camera.up).normalize();

      // 移動
      camera.position.addScaledVector(forward, moveY * speed);
      camera.position.addScaledVector(right,   moveX * speed);
    }    
    // if (movingForward) {
    //   camera.getWorldDirection(direction);
    //   camera.position.addScaledVector(direction, speed);
    // }
  } else {
    direction.set(0, 0, 0);
    if (keyState['KeyS']) direction.z -= 1;
    if (keyState['KeyW']) direction.z += 1;
    if (keyState['KeyA']) direction.x -= 1;
    if (keyState['KeyD']) direction.x += 1;

    direction.normalize();

    if (controls.isLocked) {
      controls.moveRight(direction.x * speed);
      controls.moveForward(direction.z * speed);
    }
  }
}

/* =========================
   Artwork画像設定
========================= */
const artworkTextures = {
  'Artwork_01': './artworks/art01.jpg',
  'Artwork_02': './artworks/art02.jpg',
  'Artwork_03': './artworks/art03.jpg',
  'Artwork_04': './artworks/art04.jpg',
  'Artwork_05': './artworks/art05.jpg',
};

const textureLoader = new THREE.TextureLoader();

/* =========================
   glb読み込み
========================= */
const loader = new GLTFLoader();
loader.load('./Virtual_Museum_navy.glb', (gltf) => {
  const model = gltf.scene;

  model.traverse((obj) => {
    if (obj.isMesh && artworkTextures[obj.name] && artworkData[obj.name]) {

      const tex = textureLoader.load(artworkTextures[obj.name]);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.flipY = false; // glTF対策

      obj.material = new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.6,
        metalness: 0.0,
      });

      // アートワーク情報をオブジェクトに追加
      obj.userData.isArtwork = true;
      obj.userData.author = artworkData[obj.name].author;
      obj.userData.title = artworkData[obj.name].title;
      obj.userData.description = artworkData[obj.name].description;
      obj.userData.viewingDistance = artworkData[obj.name].viewingDistance;

      console.log(`Artwork applied: ${obj.name}`);
      artworks.push(obj);
    }
  });

  scene.add(model);
});

/* =========================
   鑑賞モード用
========================= */
function checkIntersections() {
  if (isViewing) return;
  raycaster.setFromCamera(pointer, camera);
  const intersects = raycaster.intersectObjects(artworks, true);
  if (intersects.length > 0) {
    const object = intersects[0].object;
    if (object.userData.isArtwork) {
      showViewButton(object);
      return true;
    }

  } else {
    hideViewButton();
    return false;
  }
}

function showViewButton(artwork) {
  currentArtwork = artwork;
  // if (isMobile) {return ;} // モバイルでは非表示
  viewButton.style.display = 'block';
}

function hideViewButton() {
  viewButton.style.display = 'none';
  currentArtwork = null;
}

function enterViewMode(artwork) {
  isViewing = true;
  hideViewButton();
  // PCならポインタロック解除
  if (controls && controls.isLocked) {
    controls.unlock();
  }
  if (controls) {
    controls.enabled = false;
  }
  previousCameraPosition.copy(camera.position);
  const distance = artwork.userData.viewingDistance;
  const direction = new THREE.Vector3(0, 1, 0);
  direction.applyQuaternion(artwork.quaternion);
  const targetPosition = artwork.position.clone()
    .add(direction.multiplyScalar(distance));
  camera.position.copy(targetPosition);
  camera.lookAt(artwork.position);
  showArtworkInfo(
    artwork.userData.author,
    artwork.userData.title,
    artwork.userData.description
  );
}

function showArtworkInfo(author, title, description) {
  // アートワーク情報表示
  document.getElementById('artworkTitle').textContent = `${author}  -  「${title}」`;
  document.getElementById('artworkDescription').textContent = description;
  // hidden クラス削除
  document.getElementById('artworkInfo').classList.remove('hidden');
}

function exitViewMode() {
  isViewing = false;
  camera.position.copy(previousCameraPosition);
  if (controls) {
    controls.enabled = true;
  }
  // hidden クラス追加
  document.getElementById('artworkInfo').classList.add('hidden');
}

// 鑑賞モード入口
function requestEnterViewMode() {
  if (isViewing) return;
  if (!currentArtwork) return;
  enterViewMode(currentArtwork);
}

/* =========================
   ウィンドウリサイズ対応
========================= */
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

/* =========================
   アニメーションループ
========================= */
function animate() {
  requestAnimationFrame(animate);

  checkIntersections();

  updateMovement();
  // direction.set(0, 0, 0);
  // if (keys['KeyS']) direction.z -= 1;
  // if (keys['KeyW']) direction.z += 1;
  // if (keys['KeyA']) direction.x -= 1;
  // if (keys['KeyD']) direction.x += 1;

  // direction.normalize();
  // velocity.copy(direction).multiplyScalar(moveSpeed * 0.016);

  // controls.moveRight(velocity.x);
  // controls.moveForward(velocity.z);
  
  // spotHelpers.forEach(h => h.update());

  // if (movingForward) {
  //   const dir = new THREE.Vector3();
  //   camera.getWorldDirection(dir);
  //   camera.position.addScaledVector(dir, speed);
  // }

  renderer.render(scene, camera);
}

animate();
