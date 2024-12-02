console.log("three.js Version: " + THREE.REVISION);

let container, gui, stats;
let scene, camera, renderer;
let controls;
let time, frame = 0;
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let canJump = true;
let moveVelocity = 0.1;
let jumpVelocity = 0;
let jumpAccel = 10;
let fallAccel = 0.3;
let raycaster;

const clock = new THREE.Clock();

function initThree() {
  scene = new THREE.Scene();
  const listener = new THREE.AudioListener();
  const fov = 75;
  const aspectRatio = window.innerWidth / window.innerHeight;
  const near = 0.1;
  const far = 10000;
  camera = new THREE.PerspectiveCamera(fov, aspectRatio, near, far);
  camera.position.z = 30;
  camera.position.y = 35;
  camera.position.x = 50;
  camera.add(listener);

  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.shadowMap.enabled = true;
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  container = document.getElementById("container-three");
  container.appendChild(renderer.domElement);

  //controls = new OrbitControls(camera, renderer.domElement);
  //const controls = new DragControls( objects, camera, renderer.domElement );
  //controls = new MapControls(camera, renderer.domElement);
  //controls = new FirstPersonControls(camera, renderer.domElement);
  // First Person
  // controls.lookSpeed = 0.05;
  // controls.movementSpeed = 5;
  // Map
  // controls.minDistance = -20;
  // controls.maxDistance = 400;
  // controls.minPolarAngle = 0;
  // controls.maxPolarAngle = Math.PI / 2 - 0.42;
  // controls.listenToKeyEvents(window); // optional
  // controls.keys = {
  //   LEFT: "KeyA", // A
  //   UP: "KeyW", // W
  //   RIGHT: "KeyD", // D
  //   BOTTOM: "KeyS" //
  // }
  // PointerLock
  controls = new PointerLockControls(camera, renderer.domElement);
  controls.pointerSpeed = 1;
  
  scene.add( controls.object );

  gui = new dat.GUI();
  raycaster = new THREE.Raycaster( new THREE.Vector3(), new THREE.Vector3( 0, - 1, 0 ), 0, 10 );
  stats = new Stats();
  stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
  document.body.appendChild(stats.domElement);



  setupThree(); // *** 

  renderer.setAnimationLoop(animate);
}

function animate() {
  stats.update();
  time = performance.now();
  frame++;

  updateThree(); // ***
  renderer.render(scene, camera);
  //if (camera.position.y < 35) camera.position.y = 35;
  // firstperson
  // controls.update(clock.getDelta());
 
}

window.addEventListener("resize", function () {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});



