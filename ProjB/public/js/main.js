const terrainDimension = 400;
const homeBoundaryPositive = 110;
const homeBoundaryNegative = -110;
const skyBoundaryNegative = -300;
const skyBoundaryPositive = 300;
const internalBoundary = 25;
const homeBoundaryPositiveWBoundaries = homeBoundaryPositive - internalBoundary;
const homeBoundaryNegativeWBoundaries = homeBoundaryNegative + internalBoundary;
const terrainHeight = 20 + 0.001;
const colors = {
  green: 0x6c932e, // 0x59ac27, 0x6c932e, 0xA5C23A, 0x31772f
  darkMetal: 0x72636a,
  lightMetal: 0xdcbbb4,
  brownBrick: 0xffdba9,
  wood: 0xa76e17,
  brick: 0xd6b48e,
  roof: 0x783031,
  fog: 0xfdfcf7, // 0x80b6dc
  redBrick: 0x6e1e29,
  water: 0x52a5c1, // 0x1E6E63, 0x13463F, 0x007577, 0x13463F, 0x6EB7AE, 0x09846F, 0x2F6468
  glass: 0x86a3ac,
  dirt: 0x9b7653, // 0x4F3C2A, 0x9B7653
  pineGreen: 0x31772f, // 0x132408, 0x0A4920, 0x0D5B28, 0x21400F, 0x0A4920, 0x307853
  pineWood: 0x7e563b,
  fenceWood: 0xa58b57, // 0x543a27, 0xbca880
  blobWood: 0xa8734e,
  rockGrey: 0x716f6b,
  chimneyGrey: 0x5a564c, // 0x2D2B26
  benchGrey: 0x716f6b,
  grassGreen: 0x396e19, // 0x2e4a1e, 0x478A1F
  fireRed: 0xe0380a,
  fireOrange: 0xf48416,
  fireDarkYellow: 0xf3cb21,
  white: 0xfdfcf7,
  black: 0x424242,
  carouselPastel: 0x8094bd,
};

const lakeBoundaries = {
  xMin: -110,
  xMax: 30,
  zMin: -60,
  zMax: 110
};
const loader = new THREE.TextureLoader();
const glftLoader = new GLTFLoader();
const objLoader = new OBJLoader();
let cow;
let cows = [];
let deadCows = [];
let trees = [];
let colli = new THREE.Group();
let blockedDirections = { forward: false, left: false, right: false, backward: false };
const audioLoader = new THREE.AudioLoader();
const listener = new THREE.AudioListener();
let client_state = {
  role: "",
  cowPositions: {},
  treePositions: {},
  cowScales: {},
  treeScales: {},
  params: {
    numTrees: 50,
    rotationSpeed: 0.01,
  }
}
let controls;
let fall = 0;
let treeMeshes = [];
let dragControls;
let temp;

function setupSocket() {
  socket = io.connect();

  socket.on("connect", () => {
    // emit a message to the server to notify of new client connection
    socket.emit("new_client");
  });

  socket.on("initialize", ({ role: assignedRole, state }) => {
    client_state.role = assignedRole;
    setupControls(assignedRole); // bypass
    setupGUI(assignedRole);
    console.log("Assigned:", client_state.role);
    Object.entries(state.treeScales).forEach(([index, scale]) => {
      client_state.treeScales[index] = scale;
    })
    Object.entries(state.cowScales).forEach(([index, scale]) => {
      client_state.cowScales[index] = scale;
    })
  });

  // listen for changes
  socket.on("update-tree", function (index, position) {
    const t = trees[index];
    if (t) {
      t.setPosition(position.x, position.y, position.z);
    }
  });
  socket.on("update-cow", function (index, position) {
    const c = cows[index];
    if (c.fallen) {
      c.setPosition(position.x, position.y, position.z);
    }
    console.log("cow updated");
  });
  socket.on("update-gui", function (updatedParams) {
    client_state.params = { ...client_state.params, ...updatedParams }
    loadTrees();
  })
  socket.on("fall-cow", function (idx) {
    cows[idx].fall();
  })
}

function setupControls(role) {
  // define control based on role
  if (role === "view-only") {
    controls = new OrbitControls(camera, renderer.domElement);
    // controls = new PointerLockControls(camera, renderer.domElement);
    // scene.add(controls.object);
    //console.log("controls:", controls);
    // event listeners
    // document.addEventListener('keydown', onKeyDown);
    // document.addEventListener('keyup', onKeyUp);
  } else if (role === 'gui-control') {
    controls = new OrbitControls(camera, renderer.domElement);
  } else if (role === "cow-control") {
    // dragcontrol for other users
    controls = new DragControls(deadCows, camera, renderer.domElement);
    // Get the current mouse position
    controls.addEventListener('dragstart', function (event) {

      event.object.material.emissive.set(0xaaaaaa);

    });

    controls.addEventListener('dragend', function (event) {
      event.object.material.emissive.set(0x000000);
      const draggedObject = event.object; // The object that was dragged
      let cowIndex = -1;

      // Find the index of the dragged cow in the cows array
      for (let i = 0; i < cows.length; i++) {
        if (cows[i].mesh === draggedObject) {
          cowIndex = i;
          break;
        }
      }

      if (cowIndex !== -1) {
        // Update client_state.cowPositions with the new position
        const position = draggedObject.position;
        client_state.cowPositions[cowIndex] = {
          x: position.x,
          y: position.y,
          z: position.z,
        };
      }
    });
  } else if (role === "tree-control") { //only works after treeMeshes is loaded
    // dragcontrol for other users
    controls = new OrbitControls(camera, renderer.domElement);
    dragControls = new DragControls(treeMeshes, camera, renderer.domElement);
    const draggableObjects = control.objects;
    draggableObjects.length = 0;
    raycaster.setFromCamera(mouse, camera);

    const intersections = raycaster.intersectObjects(objects, true);
    dragControls.addEventListener('dragstart', function (event) {
      event.object = event.object.parent;
      // temp = event.object
      console.log("drag", event.object);
      event.object.children[0].material.emissive.set(0xaaaaaa);
      event.object.children[1].material.emissive.set(0xaaaaaa);
      controls.enabled = false;
    });

    dragControls.addEventListener('dragend', function (event) {
      // event.object = event.object.parent;
      // console.log("drag", event.object);
      // event.object[children][0].material.emissive.set(0x000000);
      // event.object[children][1].material.emissive.set(0x000000);
      const draggedObject = event.object; // The object that was dragged
      //console.log(draggedObject);
      let treeIndex = -1;

      // Find the index of the dragged cow in the cows array
      for (let i = 0; i < trees.length; i++) {
        if (trees[i].mesh === draggedObject) {
          treeIndex = i;
          break;
        }
      }

      if (treeIndex !== -1) {
        // Update client_state.cowPositions with the new position
        const position = draggedObject.position;
        client_state.treePositions[treeIndex] = {
          x: position.x,
          y: position.y,
          z: position.z,
        };
      }
      controls.enabled = true;
    });
  }
}


function setupGUI(role) {
  const isEditable = role === "gui-control"; // Allow only "gui-control" role to edit
  if (isEditable) {
    const numTreesController = gui.add(client_state.params, 'numTrees', 10, 50, 1)
      .name('numTrees');
    const rotationSpeedController = gui.add(client_state.params, 'rotationSpeed', 0.01, 1, 0.01)
      .name('Rotation Speed');
    numTreesController.onChange(() => {
      socket.emit("update-gui", { numTrees: client_state.params.numTrees });
      loadTrees();
    });
    rotationSpeedController.onChange(() => {
      socket.emit("update-gui", { rotationSpeed: client_state.params.rotationSpeed });
    });
    gui.add({ fall: () => sendFall() }, 'fall')
      .name('Fall!');
  }

}

function sendFall() {
  socket.emit("fall-cow", fall);
  cows[fall].fall();
  fall += 1;
}

function setupThree() {
  setupSocket();
  setupControls();
  // sound
  const ambientSound = new THREE.Audio(listener);
  camera.add(listener);

  // background sound
  audioLoader.load('./assets/wind_birds.mp3', function (buffer) {
    ambientSound.setBuffer(buffer);
    ambientSound.setLoop(true);
    ambientSound.setVolume(1);
    ambientSound.play();
    //console.log(ambientSound);
    //getAudioContext().resume();
  })


  // sky
  const sky = new Sky();
  sky.scale.setScalar(450000);
  const phi = THREE.MathUtils.degToRad(90);
  const theta = THREE.MathUtils.degToRad(180);
  const sunPosition = new THREE.Vector3().setFromSphericalCoords(1, phi, theta);
  sky.material.uniforms.sunPosition.value = sunPosition;
  sky.sunPosition = new THREE.Vector3(-280, 695, 350);
  scene.add(sky);


  const lakeDisplacementMap = loader.load(
    "./assets/laketerraindisplacementmap.png"
  );
  const waterDisplacementMap = loader.load("./assets/waterdisplacementmap.png");
  //light
  const hemisphereLight = new THREE.HemisphereLight(0xaaaaaa, 0x000000, 0.9);
  const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
  let sunLight = new THREE.DirectionalLight(0xffffff, 0.75);

  sunLight.position.set(-280, 695, 350);
  sunLight.target.position.set(0, 0, 0);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.width = 1024; //8192, 6144, 4096, 2048, 1024
  sunLight.shadow.mapSize.height = 1024; //8192, 6144, 4096, 2048, 1024
  // We make the near and far planes as tight as possible
  sunLight.shadow.camera.near = 380;
  sunLight.shadow.camera.far = 1450;
  sunLight.shadow.camera.left = skyBoundaryNegative;
  sunLight.shadow.camera.right = skyBoundaryPositive;
  sunLight.shadow.camera.top = skyBoundaryPositive;
  sunLight.shadow.camera.bottom = skyBoundaryNegative;
  // a parameter you can tweak if there are artifacts
  sunLight.shadow.bias = -0.0001;

  scene.add(hemisphereLight);
  scene.add(ambientLight);
  scene.add(sunLight);
  scene.add(sunLight.target);


  var geoDirtTerrain = new THREE.BoxGeometry(
    terrainDimension,
    25,
    terrainDimension,
    1,
    1,
    1
  );
  // material array (we want to avoid having to compute shadows on the top side)
  // we leave them on on the rest of the box
  var allMatDirtTerrain = [];
  var matDirtTerrain = new THREE.MeshLambertMaterial({
    color: colors.dirt,
    wireframe: false, // for debugging
  });
  // MeshBasicMaterial -> not affected by lights
  var matDirtTerrainNoShadow = new THREE.MeshBasicMaterial({
    //color: colors.dirt,
    transparent: true,
    opacity: 0,
    wireframe: false, // for debugging
  });
  allMatDirtTerrain.push(matDirtTerrain); // right side
  allMatDirtTerrain.push(matDirtTerrain); // left side
  allMatDirtTerrain.push(matDirtTerrainNoShadow); // top side
  allMatDirtTerrain.push(matDirtTerrain); // bottom side
  allMatDirtTerrain.push(matDirtTerrain); // front side
  allMatDirtTerrain.push(matDirtTerrain); // back side
  var dirtTerrain = new THREE.Mesh(geoDirtTerrain, allMatDirtTerrain);
  dirtTerrain.rotation.y = Math.PI / 4;
  dirtTerrain.receiveShadow = true;
  scene.add(dirtTerrain);
  // grass terrain - top box (container)
  // var used to place all the objects on top of the terrain

  // container box
  // we create a box and hide the top face, in order to make space for the lake terrain
  // other options, create 6 different planes
  var geoTerrain = new THREE.BoxGeometry(
    terrainDimension + 10,
    terrainHeight,
    terrainDimension + 10,
    1,
    1,
    1
  );
  var matTerrain = new THREE.MeshLambertMaterial({
    color: colors.green,
    wireframe: false, // for debugging
  });
  // MeshBasicMaterial -> not affected by lights
  var matTerrainInvisible = new THREE.MeshBasicMaterial({
    //color: colors.green,
    transparent: true,
    opacity: 0,
    wireframe: false, // for debugging
    depthWrite: false,
  });
  // material array (we want to make only the top side of the box invisible)
  var allMatTerrain = [];
  allMatTerrain.push(matTerrain); // right side
  allMatTerrain.push(matTerrain); // left side
  allMatTerrain.push(matTerrainInvisible); // top side
  allMatTerrain.push(matTerrain); // bottom side
  allMatTerrain.push(matTerrain); // front side
  allMatTerrain.push(matTerrain); // back side
  var terrain = new THREE.Mesh(geoTerrain, allMatTerrain);
  // the connection part between the green box and the dirt box is hidden so no
  // need to avoid Y flickering
  // could be stil done on low specs machines, to keep the GPU happy
  terrain.position.y = 12.5 + terrainHeight / 2; //+ 0.001;
  terrain.castShadow = true;
  terrain.receiveShadow = true;
  // add grass terrain to dirt terrain
  dirtTerrain.add(terrain);

  // grass terrain - top surface - lake
  // plane with displacement map/height map (64x64 PNG)
  // max depth of the lake
  const lakeDepth = 19;
  var geoLakeTerrain = new THREE.PlaneGeometry(
    terrainDimension + 10,
    terrainDimension + 10,
    128,
    128
  );
  var matLakeTerrain = new THREE.MeshPhongMaterial({
    //color: colors.green,
    flatShading: true,
    displacementMap: lakeDisplacementMap,
    displacementScale: lakeDepth, // max depth of the lake
    vertexColors: true, // used to give each vertex different colours (make the lake brown)
    shininess: 0,
    specular: 0x000000,
    wireframe: false, // for debugging
  });
  const geoLakeTerrainVerts = geoLakeTerrain.attributes.position;
  // creating color attribute
  geoLakeTerrain.setAttribute(
    "color",
    new THREE.BufferAttribute(new Float32Array(geoLakeTerrainVerts.count * 3), 3)
  );
  const tempColor = new THREE.Color();
  const geoLakeTerrainColor = geoLakeTerrain.attributes.color;
  for (let i = 0; i < geoLakeTerrainVerts.count; i++) {
    // lake terrain is brown
    if (
      geoLakeTerrainVerts.getY(i) >= -70 &&
      geoLakeTerrainVerts.getY(i) <= 70 &&
      geoLakeTerrainVerts.getX(i) >= -70 &&
      geoLakeTerrainVerts.getX(i) <= -35
    ) {
      tempColor.set(colors.dirt);
      geoLakeTerrainColor.setXYZ(i, tempColor.r, tempColor.g, tempColor.b);
    } else if (
      geoLakeTerrainVerts.getY(i) >= 30 &&
      geoLakeTerrainVerts.getY(i) <= 70 &&
      geoLakeTerrainVerts.getX(i) >= -70 &&
      geoLakeTerrainVerts.getX(i) <= -25
    ) {
      tempColor.set(colors.dirt);
      geoLakeTerrainColor.setXYZ(i, tempColor.r, tempColor.g, tempColor.b);
    } else if (
      geoLakeTerrainVerts.getY(i) >= 40 &&
      geoLakeTerrainVerts.getY(i) <= 70 &&
      geoLakeTerrainVerts.getX(i) >= -70 &&
      geoLakeTerrainVerts.getX(i) <= -2
    ) {
      tempColor.set(colors.dirt);
      geoLakeTerrainColor.setXYZ(i, tempColor.r, tempColor.g, tempColor.b);
    } else {
      // rest of the terrain is green
      tempColor.set(colors.green);
      geoLakeTerrainColor.setXYZ(i, tempColor.r, tempColor.g, tempColor.b);
    }
  }
  var lakeTerrain = new THREE.Mesh(geoLakeTerrain, matLakeTerrain);
  // placing the lowest point possible of the height map at the top side of the grass box (container)
  // we remove the Y flickering value added to terrain box, so any internal parts are hidden
  lakeTerrain.position.y = -lakeDepth + terrainHeight / 2 - 0.001;
  lakeTerrain.castShadow = true; // cast shadows mainly for the lake "zone"
  lakeTerrain.receiveShadow = true;
  lakeTerrain.rotation.x = -Math.PI / 2;
  // add lake terrain to grass terrain so we can move it around as one object
  terrain.add(lakeTerrain);

  // lake - water
  // water level, max 11 - min 3
  var waterLevel = 12; // lower is less water
  var geoLakeWater = new THREE.PlaneGeometry(
    homeBoundaryPositive / 2 + 30,
    homeBoundaryPositive * 2,
    16,
    16
  );
  var matLakeWater = new THREE.MeshPhongMaterial({
    color: colors.water,
    flatShading: true,
    displacementMap: waterDisplacementMap,
    displacementScale: 8,
    //specularMap: waterSpecularMap,
    specular: 0xf2efe8, //0x337374, 0xaaaaaa, 0x99C8C9, 0x4E4E4E, 0x337374
    shininess: 500,
    opacity: 0.8,
    transparent: true,
    wireframe: false,
  });
  var lakeWater = new THREE.Mesh(geoLakeWater, matLakeWater);
  lakeWater.receiveShadow = true;
  lakeWater.position.x = homeBoundaryNegative + homeBoundaryPositive / 2 + 20;
  lakeWater.position.z = waterLevel; // we don't modify Y anymore, but Z
  // since lakeWater is added to lakeTerrain which has already a -Math.PI/2 rotation
  lakeTerrain.add(lakeWater);


  // load farmhouse model
  objLoader.load("./assets/Barn.obj",
    function (object) {
      object.position.y = terrainHeight / 2;
      object.position.x =
        (homeBoundaryPositiveWBoundaries - internalBoundary / 2) / 2 +
        internalBoundary / 2 - 20;
      object.position.z =
        (homeBoundaryNegativeWBoundaries + internalBoundary / 2) / 2 -
        internalBoundary / 2 + 20;
      object.rotation.y = -Math.PI / 2
      object.scale.set(2, 2, 2);
      //console.log(object.getObjectByName("Barn_Cube.005"));
      //object.getObjectByName("Barn_Cube.005").material.color.setHex(colors.darkMetal);
      object.getObjectByName("Barn_Cube.005").material[0].color.setHex("0x8d3c29");
      object.getObjectByName("Barn_Cube.005").material[1].color.setHex("0xfae5c0");
      object.getObjectByName("Barn_Cube.005").material[2].color.setHex("0xd65a36");
      object.getObjectByName("Barn_Cube.005").material[3].color.setHex("0x918162");
      //shadow
      object.traverse(function (node) {
        if (node.isMesh) {
          node.castShadow = true;
          node.receiveShadow = true;
        }
      })

      terrain.add(object);

      //object.position.set(0,100,0);
    }
  )

  // flying cows
  loadAndCreateCows();
  loadTrees();
  // console.log("trees", trees[0]); // asynchronousss!!!
  // for (let i = 0; i < trees.length; i++) {
  //   console.log("i", i);
  //   treeMeshes.push(trees[i].mesh);
  // }
  // console.log("mesh", treeMeshes);
  // console.log("control", dragControls);
  scene.add(colli);
}

function updateThree() {
  //console.log("in update", client_state.role);
  for (let i = 0; i < trees.length; i++) {
    trees[i].update();
  }
  if (cows.length > 0) {
    const time = Date.now() * 0.01; // Use time for smooth rotation
    for (let i = 0; i < cows.length; i++) {
      cows[i]
        .setRadius(100)
        .setSpeed(client_state.params.rotationSpeed)
        .update(time);
    }
  }
  if (client_state.role === 'view-only') {

    // if (controls.isLocked === true) {
    //   raycaster.ray.origin.copy(controls.object.position);
    //   const directions = {
    //     forward: new THREE.Vector3(0, 0, -1), //front
    //     right: new THREE.Vector3(1, 0, 0), //right
    //     left: new THREE.Vector3(-1, 0, 0), //left
    //     backward: new THREE.Vector3(0, 0, 1), //back
    //   };
    //   // Reset blocked directions
    //   Object.keys(blockedDirections).forEach((key) => {
    //     blockedDirections[key] = false;
    //   });

    //   // Check for collisions in each direction
    //   Object.entries(directions).forEach(([key, direction]) => {
    //     const rayDirection = direction.clone().applyQuaternion(controls.object.quaternion).normalize();
    //     raycaster.ray.origin.copy(controls.object.position);
    //     raycaster.ray.direction.copy(rayDirection);
    //     const intersections = raycaster.intersectObjects(colli.children, true); //has to be object3D -- mesh
    //     if (intersections.length > 0 && intersections[0].distance < 1) {
    //       console.log(blockedDirections);
    //       blockedDirections[key] = true; // Block movement in this direction
    //     }
    //   });
    //   if (blockedDirections.forward) console.log(blockedDirections);
    //   if (!blockedDirections.forward && moveForward) {
    //     controls.moveForward(moveVelocity);
    //   } else if (!blockedDirections.backward && moveBackward) {
    //     controls.moveForward(-moveVelocity);
    //   }
    //   if (!blockedDirections.left && moveLeft) {
    //     controls.moveRight(-moveVelocity);
    //   } else if (!blockedDirections.right && moveRight) {
    //     controls.moveRight(moveVelocity);
    //   }
    //   // jump
    //   controls.object.position.y += jumpVelocity;

    //   //console.log(controls.object.position);
    //   if (controls.object.position.y > 35) {
    //     jumpVelocity -= fallAccel;
    //   } else {
    //     controls.object.position.y = 35;
    //     jumpVelocity = 0;
    //     canJump = true;
    //   }
    //}
  }
  if (client_state.role === "tree-control") {
    socket.emit("update-tree", client_state.treePositions);
  } else if (client_state.role === "cow-control") {
    socket.emit("update-cow", client_state.cowPositions);
  }
}

class Cow {
  constructor(model) {
    // Clone the provided model for each instance
    this.mesh = clone(model);
    this.angleOffset = 0;
    this.angle = 0;
    this.radius = 0;
    this.height = 0;
    this.speed = 0;
    this.fallen = false;
    this.scale = new THREE.Vector3(1, 1, 1);
    this.fallVelocity = 0; // Velocity during the fall
    this.fallAcc = 0;
    this.position = new THREE.Vector3();
    this.rotation = new THREE.Vector3();
    this.mass = 1;
    this.mesh.traverse((node) => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
      }
    });
    scene.add(this.mesh);
  }
  setSpeed(s) {
    this.speed = s;
    return this;
  }
  setAngleOffset(o) {
    this.angleOffset = o;
    return this;
  }
  setRadius(r) {
    this.radius = r;
    return this;
  }
  setHeight(h) {
    this.height = h;
    return this;
  }
  setScale(s) {
    this.scale.x = s;
    this.scale.y = s;
    this.scale.z = s;
    this.mesh.scale.set(this.scale.x, this.scale.y, this.scale.z);
    this.mass = 1 + this.scale.x * 0.01;
    return this;
  }
  setPosition(x, y, z) {
    if (x < -200) x = -200
    if (x > 200) x = 200
    if (z < -200) z = -200
    if (z > 200) z = 200
    if (y < 30) y = 30
    if (y > 200) y = 200
    this.mesh.position.x = x;
    this.mesh.position.y = y;
    this.mesh.position.z = z;
  }
  update(time) {
    if (!this.fallen) {
      const currentAngle = time * this.speed + this.angleOffset;
      this.position.x = this.radius * Math.cos(currentAngle);
      this.position.y = this.height;
      this.position.z = this.radius * Math.sin(currentAngle);
      this.mesh.position.set(this.position.x, this.position.y, this.position.z);
      this.mesh.rotation.y = currentAngle;
    }
  }

  // Trigger the fall
  fall() {
    if (this.fallen) return; // Prevent multiple falls for the same cow
    this.fallen = true;
    deadCows.push(this.mesh);
    // Stop rotation and note the current position
    this.mesh.rotation.set(0, 0, 0);

    const animateFall = () => {
      if (this.mesh.position.y > 30) {
        this.fallAcc = 0.01; // g is the same for all objects
        this.fallVelocity += this.fallAcc; // Gravity affects velocity
        this.mesh.position.y -= this.fallVelocity; // Apply falling motion
        requestAnimationFrame(animateFall);
      } else {
        this.mesh.position.y = 30; // Stop at ground level
        this.fallVelocity = 0; // Reset velocity
        const sound = this.mesh.children[1];
        sound.play();
        sound.setVolume(2 * this.scale.x);
        //getAudioContext().resume();
      }
    };

    animateFall();
  }
}



function loadAndCreateCows() {
  glftLoader.load("./assets/Cow.gltf", function (gltf) {
    const cowModel = gltf.scene;
    for (let i = 0; i < 15; i++) {
      const angleOffset = (i / 15) * Math.PI * 2; // Spread cows evenly in a circle
      const cowScale = client_state.cowScales[i];
      const height = 200;
      let cow = new Cow(cowModel)
        .setAngleOffset(angleOffset)
        .setHeight(height)
        .setScale(cowScale) //created by server
        .setSpeed(client_state.params.rotationSpeed)
        .setRadius(100);
      cows.push(cow);
      colli.add(cow.mesh);
      audioLoader.load('./assets/explode2.mp3', function (buffer) {
        const audio = new THREE.PositionalAudio(listener);
        audio.setBuffer(buffer);
        cow.mesh.add(audio);
      })
    }
  }
  )
}


class Tree {
  constructor(model) {
    // Clone the provided model for each instance
    this.mesh = clone(model);
    this.position = new THREE.Vector3();
    this.scl = new THREE.Vector3(1, 1, 1);
    this.mesh.rotation.y = Math.random() * Math.PI * 2; // Random rotation
    this.mesh.traverse((node) => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
      }
    });
    // Add to the scene
    scene.add(this.mesh);
  }
  setPosition(x, y, z) {
    this.position.x = x;
    this.position.y = y;
    this.position.z = z;
    return this;
  }
  setScale(s) {
    this.scl.set(s, s, s);
    return this
  }
  // Set the initial position of the Tree
  update() {
    this.mesh.position.set(this.position.x, this.position.y, this.position.z);
    this.mesh.scale.set(this.scl.x, this.scl.y, this.scl.z);

  }
}

function loadTrees() {
  glftLoader.load("./assets/MapleTree_1.gltf", function (gltf) {
    const TreeModel = gltf.scene;
    if (trees.length === 0) {
      for (let i = 0; i < client_state.params.numTrees; i++) {

        do {
          // Generate random position within the full terrain bounds
          position = {
            x: map(Math.random(), 0, 1, -150, 160),
            y: terrainHeight / 2 + 20, // Adjust height as needed
            z: map(Math.random(), 0, 1, -140, 160),
          };
        } while (
          // Ensure the position is NOT within the lake boundaries
          position.x >= lakeBoundaries.xMin &&
          position.x <= lakeBoundaries.xMax &&
          position.z >= lakeBoundaries.zMin &&
          position.z <= lakeBoundaries.zMax
        );
        const scl = client_state.treeScales[i];
        const tree = new Tree(TreeModel)
          .setPosition(position.x, position.y, position.z)
          .setScale(scl);
        //console.log(tree);
        // randomize scale here!
        tree.mesh.visible = i < client_state.params.numTrees;
        trees.push(tree);
        treeMeshes.push(tree.mesh);
        colli.add(tree.mesh);
      }
    } else {
      trees.forEach((tree, index) => {
        tree.mesh.visible = index < client_state.params.numTrees; // for gui
      })
    }

  });
}


// function onKeyDown(event) {
//   controls.lock(); // *** this should be triggered by user interaction
//   switch (event.code) {
//     case 'ArrowUp':
//     case 'KeyW':
//       if (!blockedDirections.forward) moveForward = true;
//       break;
//     case 'ArrowLeft':
//     case 'KeyA':
//       if (!blockedDirections.left) moveLeft = true;
//       break;
//     case 'ArrowDown':
//     case 'KeyS':
//       if (!blockedDirections.backward) moveBackward = true;
//       break;
//     case 'ArrowRight':
//     case 'KeyD':
//       if (!blockedDirections.right) moveRight = true;
//       break;
//     case 'Space':
//       if (canJump === true) jumpVelocity += jumpAccel;
//       canJump = false;
//       break;
//   }
// };


// function onKeyUp(event) {
//   switch (event.code) {
//     case 'ArrowUp':
//     case 'KeyW':
//       moveForward = false;
//       break;
//     case 'ArrowLeft':
//     case 'KeyA':
//       moveLeft = false;
//       break;
//     case 'ArrowDown':
//     case 'KeyS':
//       moveBackward = false;
//       break;
//     case 'ArrowRight':
//     case 'KeyD':
//       moveRight = false;
//       break;
//   }
// };








