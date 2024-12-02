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
const params = {
  numMaxTrees: 50,
  numTrees: 30,
  numCows: 5,
  radius: 100,
  rotationSpeed: 0.01
}
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
let trees = [];
let colli = new THREE.Group();
let blockedDirections = { forward: false, left: false, right: false, backward: false };


function setupThree() {
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

  gui.add(params, 'numCows', 1, 20, 1).name('Number of Cows').onChange(() => {
    loadAndCreateCows(); // Function to recreate cows when number changes
  });
  gui.add(params, 'numTrees', 10, 50, 1).name('numTrees').onChange(() => {
    loadTrees();
  });
  gui.add(params, 'rotationSpeed', 0.01, 1, 0.01).name('Rotation Speed');
  gui.add({ fall: fallCow }, 'fall').name('Fall!');


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
    // disabling depthWrite in order for the transparent water to be seen
    // renderer renders opaque objects first, transparent after
    // opaque in order, then transparent in order
    // no depthwrite -> prevent the depth buffer from being written
    // https://stackoverflow.com/questions/37647853/three-js-depthwrite-vs-depthtest-for-transparent-canvas-texture-map-on-three-p
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
  console.log("lakewater", lakeWater.position);


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
  loadTrees()
  scene.add(colli);
}

function updateThree() {
  //animateFlyingCows(flyingCows.mesh, 0.005);
  if (cows.length > 0) {
    // if (cow) {
    const time = Date.now() * 0.01; // Use time for smooth rotation
    cows.forEach((cow) => {
      cow.updatePosition(time, params.rotationSpeed);
    });
    // Update the cow's position in a circular motion
    // cow.position.x = params.radius * Math.cos(time);
    // cow.position.z = params.radius * Math.sin(time);
    // cow.rotation.y = time; // Rotate to face the direction it's moving
  }
  if (controls.isLocked === true) {
    raycaster.ray.origin.copy(controls.object.position);
    const directions = {
      forward: new THREE.Vector3(0, 0, -1), //front
      right: new THREE.Vector3(1, 0, 0), //right
      left: new THREE.Vector3(-1, 0, 0), //left
      backward: new THREE.Vector3(0, 0, 1), //back
    };
    // Reset blocked directions
    Object.keys(blockedDirections).forEach((key) => {
      blockedDirections[key] = false;
    });

    // Check for collisions in each direction
    Object.entries(directions).forEach(([key, direction]) => {
      const rayDirection = direction.clone().applyQuaternion(controls.object.quaternion).normalize();
      raycaster.ray.origin.copy(controls.object.position);
      raycaster.ray.direction.copy(rayDirection);
      const intersections = raycaster.intersectObjects(colli.children, true); //has to be object3D -- mesh
      if (intersections.length > 0 && intersections[0].distance < 1) {
        console.log(blockedDirections);
        blockedDirections[key] = true; // Block movement in this direction
      }
    });
    if (blockedDirections.forward) console.log(blockedDirections);
    if (!blockedDirections.forward && moveForward) {
      controls.moveForward(moveVelocity);
    } else if (!blockedDirections.backward && moveBackward) {
      controls.moveForward(-moveVelocity);
    }
    if (!blockedDirections.left && moveLeft) {
      controls.moveRight(-moveVelocity);
    } else if (!blockedDirections.right && moveRight) {
      controls.moveRight(moveVelocity);
    }
    // jump
    controls.object.position.y += jumpVelocity;

    //console.log(controls.object.position);
    if (controls.object.position.y > 35) {
      jumpVelocity -= fallAccel;
    } else {
      controls.object.position.y = 35;
      jumpVelocity = 0;
      canJump = true;
    }
  }
}

class Cow {
  constructor(model, angleOffset, radius, height, scale) {
    // Clone the provided model for each instance
    this.mesh = clone(model);
    this.angleOffset = angleOffset;
    this.radius = radius;
    this.height = height;
    this.isFalling = false;
    this.scale = scale;
    this.position = createVector();
    this.rotation = createVector();
    this.mass = 1 + (this.scale) * 0.000001;

    // Set initial properties
    this.setInitialPosition();
    this.mesh.scale.set(scale, scale, scale);
    this.mesh.traverse((node) => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
      }
    });

    // Add to the scene
    scene.add(this.mesh);
  }

  // Set the initial position of the cow
  // setInitialPosition() {
  //   if (!this.isFalling) {
  //     this.mesh.position.set(
  //       this.radius * Math.cos(this.angleOffset),
  //       this.height,
  //       this.radius * Math.sin(this.angleOffset)
  //     );
  //     this.mesh.rotation.y = -this.angleOffset; // Make the cow face outward initially
  //     //this.mesh.rotation.z = Math.PI/2;
  //   }

  // }
  setInitialPosition() {
    if (!this.isFalling) {
      this.position.set(
        this.radius * Math.cos(this.angleOffset),
        this.height,
        this.radius * Math.sin(this.angleOffset)
      );
      this.rotation.y = -this.angleOffset; // Make the cow face outward initially
      //this.mesh.rotation.z = Math.PI/2;
    }
  }

  // Update the position of the cow for rotation
  updatePosition(time, rotationSpeed) {
    const currentAngle = time * rotationSpeed + this.angleOffset;
    this.mesh.position.x = this.radius * Math.cos(currentAngle);
    this.mesh.position.z = this.radius * Math.sin(currentAngle);
    this.mesh.rotation.y = currentAngle;
  }
  fall() {
    if (this.isFalling) return; // Prevent multiple falls for the same cow
    this.isFalling = true;
    const fallDuration = 2000; // Duration of fall in milliseconds
    const initialY = this.mesh.position.y;
    const fallStartTime = Date.now();

    const animateFall = () => {
      const elapsedTime = Date.now() - fallStartTime;
      const progress = Math.min(elapsedTime / fallDuration, 1);
      this.mesh.position.y = initialY - (initialY * progress);
      if (this.mesh.position.y <= 30) {
        this.mesh.position.y = 30;
        return;
      }
      if (progress < 1) {
        requestAnimationFrame(animateFall);
      } else {
        // Remove the cow from the scene and array once it has fallen
        scene.remove(this.mesh);
        const index = cows.indexOf(this);
        if (index > -1) {
          cows.splice(index, 1);
        }

        // Update the number of cows in the GUI
        params.numCows = cows.length;
        gui.updateDisplay();
        console.log("Cow has fallen.");
      }
    };

    animateFall();
  }
}


function loadAndCreateCows() {
  glftLoader.load("./assets/Cow.gltf", function (gltf) {
    const cowModel = gltf.scene;
    // Create initial cow instances
    createCowInstances(cowModel);
  });
}


// Function to create cow instances
function createCowInstances(model) {
  // Clear existing cows from the scene
  cows.forEach((cow) => scene.remove(cow.mesh));
  cows = []; // Clear the array

  for (let i = 0; i < params.numCows; i++) {
    const angle = (i / params.numCows) * Math.PI * 2; // Spread cows evenly in a circle
    const cowScale = map(Math.random(), 0, 1, 1, 10);
    const cow = new Cow(model, angle, params.radius, 200, cowScale);
    cows.push(cow);
    colli.add(cow.mesh);
  }
}

class Tree {
  constructor(model, position, scale) {
    // Clone the provided model for each instance
    this.mesh = clone(model);
    this.position = position;
    this.mesh.scale.set(scale, scale, scale);
    // Set initial properties
    this.setInitialPosition();
    this.mesh.traverse((node) => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
      }
    });
    // Add to the scene
    scene.add(this.mesh);
  }

  // Set the initial position of the Tree
  setInitialPosition() {
    this.mesh.position.set(this.position.x, this.position.y, this.position.z);
    this.mesh.rotation.y = Math.random() * Math.PI * 2; // Random rotation
  }
}

function loadTrees() {
  glftLoader.load("./assets/MapleTree_1.gltf", function (gltf) {
    const TreeModel = gltf.scene;

    if (trees.length === 0) {
      createTreeInstances(TreeModel);
    } else {
      trees.forEach((tree, index) => {
        tree.mesh.visible = index < params.numTrees;
      })
    }

  });
}

function createTreeInstances(model) {

  for (let i = 0; i < params.numMaxTrees; i++) {

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
    const scl = map(Math.random(), 0, 1, 1, 35);
    const tree = new Tree(model, position, scl);
    //console.log(tree);
    // randomize scale here!
    tree.mesh.visible = i < params.numTrees;
    trees.push(tree);
    colli.add(tree.mesh);
  }
}


function fallCow() {
  if (cows.length > 0) {
    const randomIndex = Math.floor(Math.random() * cows.length);
    cows[randomIndex].fall();
  } else {
    console.log("No cows left to fall.");
  }
}

// event listeners
document.addEventListener('keydown', onKeyDown);
document.addEventListener('keyup', onKeyUp);
function fallCow() {
  if (cows.length > 0) {
    const randomIndex = Math.floor(Math.random() * cows.length);
    cows[randomIndex].fall();
  } else {
    console.log("No cows left to fall.");
  }
}
function onKeyDown(event) {
  controls.lock(); // *** this should be triggered by user interaction
  switch (event.code) {
    case 'ArrowUp':
    case 'KeyW':
      if (!blockedDirections.forward) moveForward = true;
      break;
    case 'ArrowLeft':
    case 'KeyA':
      if (!blockedDirections.left) moveLeft = true;
      break;
    case 'ArrowDown':
    case 'KeyS':
      if (!blockedDirections.backward) moveBackward = true;
      break;
    case 'ArrowRight':
    case 'KeyD':
      if (!blockedDirections.right) moveRight = true;
      break;
    case 'Space':
      if (canJump === true) jumpVelocity += jumpAccel;
      canJump = false;
      break;
  }
};


function onKeyUp(event) {
  switch (event.code) {
    case 'ArrowUp':
    case 'KeyW':
      moveForward = false;
      break;
    case 'ArrowLeft':
    case 'KeyA':
      moveLeft = false;
      break;
    case 'ArrowDown':
    case 'KeyS':
      moveBackward = false;
      break;
    case 'ArrowRight':
    case 'KeyD':
      moveRight = false;
      break;
  }
};






