// Import Three.js and required modules
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

// Main variables
let scene, camera, renderer, controls, car, mixer;
let loadingManager, loadingScreen;
let animationClips = [];
let currentAnimation = null;
let isRotating = false;

// Function to enhance material properties for better visual quality
function enhanceMaterial(material, node) {
    if (!material) return;
    
    // Increase environment map intensity for all materials
    if (material.envMapIntensity !== undefined) {
        material.envMapIntensity = 1.5;
    }
    
    // Adjust material properties based on likely material types
    const name = (material.name || node.name || '').toLowerCase();
    
    // For car body/paint - make it glossy
    if (name.includes('body') || name.includes('paint') || name.includes('car') || name.includes('exterior')) {
        material.roughness = 0.1;
        material.metalness = 0.8;
        material.envMapIntensity = 2.0;
        material.clearcoat = 1.0;
        material.clearcoatRoughness = 0.1;
    }
    // For glass/windows - make transparent
    else if (name.includes('glass') || name.includes('window')) {
        material.transparent = true;
        material.opacity = 0.8;
        material.roughness = 0.05;
        material.metalness = 0.9;
        material.envMapIntensity = 2.5;
    }
    // For chrome/metal parts
    else if (name.includes('chrome') || name.includes('metal') || name.includes('steel') || name.includes('aluminum')) {
        material.roughness = 0.2;
        material.metalness = 1.0;
        material.envMapIntensity = 2.0;
    }
    // For rubber/tires
    else if (name.includes('rubber') || name.includes('tire') || name.includes('tyre')) {
        material.roughness = 0.9;
        material.metalness = 0.0;
        material.color.multiplyScalar(0.8); // Darken slightly
    }
    // For plastic parts
    else if (name.includes('plastic')) {
        material.roughness = 0.7;
        material.metalness = 0.1;
    }
    // For interior materials
    else if (name.includes('interior') || name.includes('seat') || name.includes('leather')) {
        material.roughness = 0.6;
        material.metalness = 0.1;
    }
    
    // Enable shadows for all materials
    material.shadowSide = THREE.FrontSide;
    
    return material;
}

// Camera positions for different views
const cameraPositions = {
    front: { position: new THREE.Vector3(0, 1, 5), target: new THREE.Vector3(0, 0.5, 0) },
    side: { position: new THREE.Vector3(5, 1, 0), target: new THREE.Vector3(0, 0.5, 0) },
    rear: { position: new THREE.Vector3(0, 1, -5), target: new THREE.Vector3(0, 0.5, 0) },
    top: { position: new THREE.Vector3(0, 5, 0), target: new THREE.Vector3(0, 0, 0) },
    interior: { position: new THREE.Vector3(0, 1, 0), target: new THREE.Vector3(0, 1, 1) }
};

// Materials for color customization
let carMaterials = {};
const defaultColor = new THREE.Color(0x005eb8); // Alpine blue

// Initialize the scene
function init() {
    loadingScreen = document.querySelector('.loading-screen');
    
    // Create loading manager to track progress
    loadingManager = new THREE.LoadingManager();
    loadingManager.onProgress = function(url, loaded, total) {
        console.log(`Loading file: ${url} (${Math.round(loaded / total * 100)}%)`);
    };
    
    loadingManager.onLoad = function() {
        setTimeout(() => {
            loadingScreen.style.opacity = '0';
            setTimeout(() => {
                loadingScreen.style.display = 'none';
            }, 500);
        }, 1000);
    };

    // Create scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf5f5f5);
    
    // Add ambient light - increased intensity for better base illumination
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);
    
    // Add hemisphere light for more natural lighting from sky/ground
    const hemiLight = new THREE.HemisphereLight(0xddeeff, 0x202020, 0.5);
    scene.add(hemiLight);
    
    // Main key light (simulating studio lighting)
    const mainLight = new THREE.DirectionalLight(0xffffff, 1.2);
    mainLight.position.set(10, 10, 10);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 2048;
    mainLight.shadow.mapSize.height = 2048;
    mainLight.shadow.camera.near = 0.5;
    mainLight.shadow.camera.far = 50;
    mainLight.shadow.camera.left = -10;
    mainLight.shadow.camera.right = 10;
    mainLight.shadow.camera.top = 10;
    mainLight.shadow.camera.bottom = -10;
    mainLight.shadow.bias = -0.0001;
    scene.add(mainLight);
    
    // Fill light from opposite side
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.8);
    fillLight.position.set(-10, 8, -10);
    scene.add(fillLight);
    
    // Rim light for highlighting edges
    const rimLight = new THREE.DirectionalLight(0xffffff, 0.6);
    rimLight.position.set(0, 5, -10);
    scene.add(rimLight);
    
    // Add spotlight for dramatic effect on the front of the car
    const spotlight = new THREE.SpotLight(0xffffff, 1);
    spotlight.position.set(5, 10, 15);
    spotlight.angle = Math.PI / 6;
    spotlight.penumbra = 0.3;
    spotlight.decay = 1.5;
    spotlight.distance = 40;
    spotlight.castShadow = true;
    spotlight.shadow.mapSize.width = 1024;
    spotlight.shadow.mapSize.height = 1024;
    spotlight.shadow.bias = -0.0001;
    scene.add(spotlight);
    
    // Setup camera
    const canvasContainer = document.querySelector('.canvas-container');
    const aspect = canvasContainer.clientWidth / canvasContainer.clientHeight;
    camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
    camera.position.set(5, 2, 5);
    
    // Setup renderer
    renderer = new THREE.WebGLRenderer({ 
        canvas: document.getElementById('car-canvas'),
        antialias: true 
    });
    renderer.setSize(canvasContainer.clientWidth, canvasContainer.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    
    // Setup controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 3;
    controls.maxDistance = 15;
    controls.target.set(0, 0.5, 0);
    controls.update();
    
    // Add environment and get the update function
    const updateEnvironment = addEnvironment();
    
    // Load the car model
    loadCarModel();
    
    // Handle window resize
    window.addEventListener('resize', onWindowResize);
    
    // Start animation loop
    animate();
    
    // Setup UI event listeners
    setupEventListeners();
}

// Load the car model
function loadCarModel() {
    // Setup DRACO loader for compressed models
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
    
    // Setup GLTF loader
    const gltfLoader = new GLTFLoader(loadingManager);
    gltfLoader.setDRACOLoader(dracoLoader);
    
    // Load the model
    const modelPath = 'a110-gt4-alpine-team-2024-wwwvecarzcom/source/a110_gt4__www_vecarz_com.glb';
    gltfLoader.load(modelPath, (gltf) => {
        car = gltf.scene;
        
        // Enable shadows
        car.traverse((node) => {
            if (node.isMesh) {
                node.castShadow = true;
                node.receiveShadow = true;
                
                // Store materials for color customization and enhance them
                if (node.material) {
                    // Clone the material to avoid affecting other parts
                    if (Array.isArray(node.material)) {
                        node.material = node.material.map(mat => {
                            const clonedMat = mat.clone();
                            // Enhance material properties
                            enhanceMaterial(clonedMat, node);
                            return clonedMat;
                        });
                    } else {
                        node.material = node.material.clone();
                        // Enhance material properties
                        enhanceMaterial(node.material, node);
                    }
                    
                    // Check if it's likely to be car body material
                    const name = (node.material.name || node.name || '').toLowerCase();
                    if (name.includes('body') || 
                        name.includes('car') || 
                        name.includes('exterior') ||
                        name.includes('paint') ||
                        name.includes('hull') ||
                        name.includes('chassis')) {
                        
                        if (Array.isArray(node.material)) {
                            node.material.forEach(mat => {
                                carMaterials[mat.uuid] = mat;
                            });
                        } else {
                            carMaterials[node.material.uuid] = node.material;
                        }
                    }
                }
            }
        });
        
        // If no materials were identified as car body, use a fallback approach
        if (Object.keys(carMaterials).length === 0) {
            console.log("No car body materials identified, using fallback approach");
            
            // First try to find the largest mesh (likely the car body)
            let largestMesh = null;
            let largestSize = 0;
            
            car.traverse((node) => {
                if (node.isMesh && node.geometry) {
                    // Get an approximate size of the mesh
                    node.geometry.computeBoundingBox();
                    const box = node.geometry.boundingBox;
                    const size = box.getSize(new THREE.Vector3()).length();
                    
                    if (size > largestSize) {
                        largestSize = size;
                        largestMesh = node;
                    }
                }
            });
            
            // If we found a largest mesh, use its material
            if (largestMesh && largestMesh.material) {
                console.log("Using largest mesh for car body material");
                if (Array.isArray(largestMesh.material)) {
                    largestMesh.material.forEach(mat => {
                        carMaterials[mat.uuid] = mat;
                    });
                } else {
                    carMaterials[largestMesh.material.uuid] = largestMesh.material;
                }
            } 
            // If still no materials, use all materials as fallback
            if (Object.keys(carMaterials).length === 0) {
                console.log("Using all materials as fallback");
                car.traverse((node) => {
                    if (node.isMesh && node.material) {
                        if (Array.isArray(node.material)) {
                            node.material.forEach(mat => {
                                carMaterials[mat.uuid] = mat;
                            });
                        } else {
                            carMaterials[node.material.uuid] = node.material;
                        }
                    }
                });
            }
        }
        
        // Position the car
        car.position.set(0, 0, 0);
        scene.add(car);
        
        // Setup animations if available
        if (gltf.animations && gltf.animations.length > 0) {
            mixer = new THREE.AnimationMixer(car);
            animationClips = gltf.animations;
            console.log(`Loaded ${animationClips.length} animations`);
        }
        
        // Set default color
        changeCarColor(defaultColor);
    }, 
    // Progress callback
    (xhr) => {
        console.log(`${(xhr.loaded / xhr.total * 100)}% loaded`);
    }, 
    // Error callback
    (error) => {
        console.error('Error loading model:', error);
    });
}

// Add environment (floor, background, etc.)
function addEnvironment() {
    // Create a glossy floor with reflections
    const floorGeometry = new THREE.PlaneGeometry(100, 100);
    const floorMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xffffff,
        roughness: 0.1,  // More glossy
        metalness: 0.3,  // Slightly metallic for better reflections
        envMapIntensity: 1.5 // Enhance environment reflections
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
    
    // Add a subtle circular platform under the car
    const platformGeometry = new THREE.CircleGeometry(5, 64);
    const platformMaterial = new THREE.MeshStandardMaterial({
        color: 0x005eb8, // Alpine blue
        roughness: 0.2,
        metalness: 0.5
    });
    const platform = new THREE.Mesh(platformGeometry, platformMaterial);
    platform.rotation.x = -Math.PI / 2;
    platform.position.y = 0.01; // Slightly above the floor
    platform.receiveShadow = true;
    scene.add(platform);
    
    // Add subtle grid to the floor
    const grid = new THREE.GridHelper(100, 100, 0xaaaaaa, 0xdddddd);
    grid.position.y = 0.02; // Slightly above the floor to avoid z-fighting
    grid.material.opacity = 0.2;
    grid.material.transparent = true;
    scene.add(grid);
    
    // Create a simple environment map for reflections
    const cubeRenderTarget = new THREE.WebGLCubeRenderTarget(256);
    cubeRenderTarget.texture.type = THREE.HalfFloatType;
    
    const cubeCamera = new THREE.CubeCamera(0.1, 1000, cubeRenderTarget);
    scene.environment = cubeRenderTarget.texture;
    
    // Add a subtle background gradient
    const bgColors = {
        topColor: new THREE.Color(0xddeeff),
        bottomColor: new THREE.Color(0xffffff)
    };
    
    const bgVertexShader = `
        varying vec3 vWorldPosition;
        void main() {
            vec4 worldPosition = modelMatrix * vec4(position, 1.0);
            vWorldPosition = worldPosition.xyz;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `;
    
    const bgFragmentShader = `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        varying vec3 vWorldPosition;
        void main() {
            float h = normalize(vWorldPosition).y;
            gl_FragColor = vec4(mix(bottomColor, topColor, max(h, 0.0)), 1.0);
        }
    `;
    
    const bgUniforms = {
        topColor: { value: bgColors.topColor },
        bottomColor: { value: bgColors.bottomColor }
    };
    
    const bgMaterial = new THREE.ShaderMaterial({
        uniforms: bgUniforms,
        vertexShader: bgVertexShader,
        fragmentShader: bgFragmentShader,
        side: THREE.BackSide
    });
    
    const bgGeometry = new THREE.SphereGeometry(50, 32, 32);
    const bgSphere = new THREE.Mesh(bgGeometry, bgMaterial);
    scene.add(bgSphere);
    
    // Update environment map once per frame
    return function updateEnvironment() {
        if (car) {
            car.visible = false;
            cubeCamera.update(renderer, scene);
            car.visible = true;
        }
    };
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    
    // Update controls
    controls.update();
    
    // Update animations
    if (mixer) {
        mixer.update(0.016); // Approximately 60fps
    }
    
    // Handle rotation animation
    if (isRotating && car) {
        car.rotation.y += 0.005;
    }
    
    // Update environment map for reflections
    if (typeof updateEnvironment === 'function') {
        updateEnvironment();
    }
    
    // Render scene
    renderer.render(scene, camera);
}

// Handle window resize
function onWindowResize() {
    const canvasContainer = document.querySelector('.canvas-container');
    const aspect = canvasContainer.clientWidth / canvasContainer.clientHeight;
    
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    
    renderer.setSize(canvasContainer.clientWidth, canvasContainer.clientHeight);
}

// Change car color
function changeCarColor(color) {
    if (!car) return;
    
    for (const uuid in carMaterials) {
        const material = carMaterials[uuid];
        if (material.color) {
            material.color.set(color);
            
            // Adjust other properties based on color brightness
            const brightness = (color.r + color.g + color.b) / 3;
            
            // For dark colors, increase metalness and reduce roughness
            if (brightness < 0.3) {
                material.metalness = Math.min(material.metalness * 1.2, 1.0);
                material.roughness = Math.max(material.roughness * 0.8, 0.05);
            }
            // For bright colors, slightly reduce metalness
            else if (brightness > 0.7) {
                material.metalness = Math.max(material.metalness * 0.9, 0.1);
            }
            
            // For white/silver colors, make them more reflective
            if (brightness > 0.8 && Math.abs(color.r - color.g) < 0.1 && Math.abs(color.g - color.b) < 0.1) {
                material.metalness = 0.9;
                material.roughness = 0.1;
            }
            
            // For red colors, add a subtle clearcoat effect
            if (color.r > 0.7 && color.g < 0.3 && color.b < 0.3) {
                if (material.clearcoat !== undefined) {
                    material.clearcoat = 1.0;
                    material.clearcoatRoughness = 0.1;
                }
            }
        }
    }
}

// Change camera view
function changeCameraView(viewName) {
    if (!cameraPositions[viewName]) return;
    
    const view = cameraPositions[viewName];
    
    // Use GSAP for smooth camera animation
    gsap.to(camera.position, {
        x: view.position.x,
        y: view.position.y,
        z: view.position.z,
        duration: 1.5,
        ease: "power2.inOut"
    });
    
    gsap.to(controls.target, {
        x: view.target.x,
        y: view.target.y,
        z: view.target.z,
        duration: 1.5,
        ease: "power2.inOut",
        onUpdate: function() {
            controls.update();
        }
    });
}

// Play animation
function playAnimation(animationName) {
    if (!mixer || animationClips.length === 0) {
        console.log('No animations available');
        return;
    }
    
    // Stop current animation if any
    if (currentAnimation) {
        currentAnimation.stop();
    }
    
    // Find animation by name or index
    let clip;
    if (typeof animationName === 'number' && animationName < animationClips.length) {
        clip = animationClips[animationName];
    } else {
        clip = THREE.AnimationClip.findByName(animationClips, animationName);
    }
    
    // If animation found, play it
    if (clip) {
        currentAnimation = mixer.clipAction(clip);
        currentAnimation.reset();
        currentAnimation.play();
        console.log(`Playing animation: ${clip.name}`);
    } else {
        console.log(`Animation not found: ${animationName}`);
        // If specific animation not found, play the first one as fallback
        if (animationClips.length > 0) {
            currentAnimation = mixer.clipAction(animationClips[0]);
            currentAnimation.reset();
            currentAnimation.play();
            console.log(`Playing fallback animation: ${animationClips[0].name}`);
        }
    }
}

// Toggle rotation animation
function toggleRotation() {
    isRotating = !isRotating;
    return isRotating;
}

// Play showcase animation sequence
function playShowcase() {
    // Stop rotation if it's on
    isRotating = false;
    
    // Create a timeline for the showcase
    const timeline = gsap.timeline();
    
    // Add camera movements to the timeline
    Object.keys(cameraPositions).forEach((viewName, index) => {
        const view = cameraPositions[viewName];
        
        timeline.to(camera.position, {
            x: view.position.x,
            y: view.position.y,
            z: view.position.z,
            duration: 2,
            ease: "power2.inOut",
            delay: index === 0 ? 0 : 0.5
        }, index * 2.5);
        
        timeline.to(controls.target, {
            x: view.target.x,
            y: view.target.y,
            z: view.target.z,
            duration: 2,
            ease: "power2.inOut",
            onUpdate: function() {
                controls.update();
            }
        }, index * 2.5);
    });
    
    // Return to the initial position
    const initialView = cameraPositions.front;
    timeline.to(camera.position, {
        x: initialView.position.x,
        y: initialView.position.y,
        z: initialView.position.z,
        duration: 2,
        ease: "power2.inOut"
    });
    
    timeline.to(controls.target, {
        x: initialView.target.x,
        y: initialView.target.y,
        z: initialView.target.z,
        duration: 2,
        ease: "power2.inOut",
        onUpdate: function() {
            controls.update();
        }
    });
}

// Setup event listeners for UI controls
function setupEventListeners() {
    // Color options
    const colorOptions = document.querySelectorAll('.color-option');
    colorOptions.forEach(option => {
        option.addEventListener('click', function() {
            // Remove active class from all options
            colorOptions.forEach(opt => opt.classList.remove('active'));
            
            // Add active class to clicked option
            this.classList.add('active');
            
            // Get color from data attribute
            const color = this.getAttribute('data-color');
            changeCarColor(new THREE.Color(color));
        });
    });
    
    // View buttons
    const viewButtons = document.querySelectorAll('.view-button');
    viewButtons.forEach(button => {
        button.addEventListener('click', function() {
            // Remove active class from all buttons
            viewButtons.forEach(btn => btn.classList.remove('active'));
            
            // Add active class to clicked button
            this.classList.add('active');
            
            // Get view from data attribute
            const view = this.getAttribute('data-view');
            changeCameraView(view);
        });
    });
    
    // Animation buttons
    const animationButtons = document.querySelectorAll('.animation-button');
    animationButtons.forEach(button => {
        button.addEventListener('click', function() {
            const animation = this.getAttribute('data-animation');
            
            if (animation === 'rotate') {
                const isActive = toggleRotation();
                this.textContent = isActive ? 'Stop Rotation' : 'Rotate';
            } else if (animation === 'showcase') {
                playShowcase();
            } else {
                playAnimation(animation);
            }
        });
    });
    
    // CTA button
    const ctaButton = document.querySelector('.cta-button');
    if (ctaButton) {
        ctaButton.addEventListener('click', function() {
            // Scroll to model viewer section
            document.querySelector('.model-viewer').scrollIntoView({ 
                behavior: 'smooth' 
            });
        });
    }
}

// Initialize everything when the page loads
window.addEventListener('DOMContentLoaded', init);