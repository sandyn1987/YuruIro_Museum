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

// タッチ操作対応
let yaw = 0;
let pitch = 0;
let lastX = 0;
let lastY = 0;
let touching = false;
let movingForward = false;

if (isMobile) {
  const sensitivity = 0.002;

  window.addEventListener('touchstart', e => {
    touching = true;
    movingForward = true;
    lastX = e.touches[0].clientX;
    lastY = e.touches[0].clientY;
  }, { passive: true });

  window.addEventListener('touchmove', e => {
    if (!touching) return;

    const x = e.touches[0].clientX;
    const y = e.touches[0].clientY;

    yaw   -= (x - lastX) * sensitivity;
    pitch -= (y - lastY) * sensitivity;

    pitch = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, pitch));

    camera.rotation.set(pitch, yaw, 0);

    lastX = x;
    lastY = y;
  }, { passive: true });

  window.addEventListener('touchend', () => {
    touching = false;
    movingForward = false;
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
    if (movingForward) {
      camera.getWorldDirection(direction);
      camera.position.addScaledVector(direction, speed);
    }
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
