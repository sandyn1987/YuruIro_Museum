import * as THREE from 'three';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';
import { PointerLockControls } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/PointerLockControls.js';
// import * as THREE from './libs/three.module.js';
// import { GLTFLoader } from './libs/GLTFLoader.js';
// import { PointerLockControls } from './libs/PointerLockControls.js';

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

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// デバイス判定
const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent);

/* =========================
   ライト（美術館向け）
========================= */
// scene.add(new THREE.AmbientLight(0xffffff, 0.6));
// const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
// dirLight.position.set(5, 10, 5);
// scene.add(dirLight);
const artworkCount = 5;
const startPos = new THREE.Vector3(-4.0, -4.8, 1.6);
const spacingX = 2.0;
const spotHelpers = [];

function createArtworkSpotLight(scene, position) {
  console.log('createArtworkSpotLight called', position);
  console.log('scene =', scene);
  const spot = new THREE.SpotLight(0xfff1e0, 1.2);

  spot.position.set(
    position.x,
    position.y + 1.2, // 手前
    position.z + 1.0  // 上
  );

  spot.intensity = 10.0;
  spot.angle = Math.PI / 4;
  spot.penumbra = 0.4;
  spot.decay = 2;
  spot.distance = 10;

  spot.castShadow = true;

  const target = new THREE.Object3D();
  target.position.copy(position);
  scene.add(target);

  spot.target = target;
  scene.add(spot);
  scene.add(spot.target);
  spot.target.updateMatrixWorld();

  const helper = new THREE.SpotLightHelper(spot);
  scene.add(helper);
  spotHelpers.push(helper);
  helper.update();

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
// PC操作のみのコード
// const controls = new PointerLockControls(camera, document.body);
// document.body.addEventListener('click', () => controls.lock());

// const keys = {};
// document.addEventListener('keydown', (e) => keys[e.code] = true);
// document.addEventListener('keyup', (e) => keys[e.code] = false);

// const moveSpeed = 3.0;
// const velocity = new THREE.Vector3();
// const direction = new THREE.Vector3();

let controls = null;
const keyState = {};

if (!isMobile) {
  controls = new PointerLockControls(camera, document.body);

  document.body.addEventListener('click', () => {
    controls.lock();
  });

  document.addEventListener('keydown', e => keyState[e.code] = true);
  document.addEventListener('keyup', e => keyState[e.code] = false);
}
// カメラ回転
let yaw = 0;
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

  camera.rotation.order = 'YXZ';
  camera.rotation.y = yaw;
  camera.rotation.x = pitch;
  camera.rotation.z = 0; // ★ロール完全禁止
}

// 仮想ジョイスティック移動
let moveX = 0;
let moveY = 0;
let joystickActive = false;
let startX = 0;
let startY = 0;

const joystick = document.getElementById('joystick-area');
const joystickBase = document.getElementById('joystick-base');
const joystickStick = document.getElementById('joystick-stick');
const JOYSTICK_RADIUS = 40;

joystick.addEventListener('pointerdown', (e) => {
  joystickActive = true;
  startX = e.clientX;
  startY = e.clientY;
  joystickBase.style.left = (startX - JOYSTICK_RADIUS) + 'px';
  joystickBase.style.top = (startY - JOYSTICK_RADIUS) + 'px';
  joystickBase.style.display = 'block';
});

window.addEventListener('pointermove', (e) => {
  if (!joystickActive) return;

  const dx = e.clientX - startX;
  const dy = e.clientY - startY;

  moveX = THREE.MathUtils.clamp(dx / 40, -1, 1);
  moveY = THREE.MathUtils.clamp(dy / 40, -1, 1);

  // スティックの位置を更新
  joystickStick.style.left = (20 + dx * 0.5) + 'px';
  joystickStick.style.top = (20 + dy * 0.5) + 'px';
});

window.addEventListener('pointerup', () => {
  joystickActive = false;
  moveX = 0;
  moveY = 0;
  joystickBase.style.display = 'none';
  joystickStick.style.left = '20px';
  joystickStick.style.top = '20px';
});

// 右画面半分ドラッグで回転（PC環境のみ）
let isRotating = false;
let lastX = 0;
let lastY = 0;

if (!isMobile){
  document.addEventListener('pointerdown', (e) => {
    // 画面右半分のみ、ジョイスティック外
    if (joystickActive) return;
    if (e.clientX > window.innerWidth / 2) {
      isRotating = true;
      lastX = e.clientX;
      lastY = e.clientY;
    }
  });
  document.addEventListener('pointermove', (e) => {
    if (!isRotating) return;

    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;

    rotateCamera(dx, dy);

    lastX = e.clientX;
    lastY = e.clientY;
  });

  document.addEventListener('pointerup', () => {
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
loader.load('./Virtual_Museum.glb', (gltf) => {
  const model = gltf.scene;

  model.traverse((obj) => {
    if (obj.isMesh && artworkTextures[obj.name]) {

      const tex = textureLoader.load(artworkTextures[obj.name]);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.flipY = false; // glTF対策

      obj.material = new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.6,
        metalness: 0.0,
      });

      console.log(`Artwork applied: ${obj.name}`);
    }
  });

  scene.add(model);
});

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
