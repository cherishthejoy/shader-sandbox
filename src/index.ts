import * as THREE from 'three';

import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import {GUI} from 'lil-gui';

import { DitherShader } from './DitherShader'
import { BlueNoiseDither } from './BlueNoiseDither';
import { ColorQuantization } from './ColorQuantization';
import { CathodeRayTube } from './CathodeRayTube';
import { GLTFLoader, UnrealBloomPass} from 'three/examples/jsm/Addons.js';
import { RGBShiftShader } from 'three/examples/jsm/Addons.js';
import { CRTad } from './CRTad';
import { AsciiShader } from './AsciiShader';
import { HueLightness } from './HueLightness';
import { ColorPalette } from './ColorPalette';
import { LegoShader } from './LegoShader';
import { Pixelize } from './Pixelize';


const clock = new THREE.Clock();


let camera: THREE.PerspectiveCamera;
let scene: THREE.Scene;
let renderer: THREE.WebGLRenderer
let controls: OrbitControls;
let light: THREE.DirectionalLight;
let composer: EffectComposer;
let disc: THREE.Mesh;

const gltfLoader = new GLTFLoader();
const textureLoader = new THREE.TextureLoader();

const shaderPasses = {
    bloomPass: null as UnrealBloomPass | null,
    chromatic: null as ShaderPass | null,
    pix: null as ShaderPass | null,
    bayerDither: null as ShaderPass | null,
    blueNoise: null as ShaderPass | null,
    colorQua: null as ShaderPass | null,
    cRayTube: null as ShaderPass | null,
    crtAd: null as ShaderPass | null,
    ascii: null as ShaderPass | null,
    hue: null as ShaderPass | null,
    pal: null as ShaderPass | null,
    lego: null as ShaderPass | null,
};

const settings = {
    activeShader: 'none',
    enableBloom: true,
    enableChrome: false,
    enablePixelize: true,
}


init()
animate()

function init() {

    let screenResolution = new THREE.Vector2(window.innerWidth, window.innerHeight)

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);

    // camera.position.set(5, 5, 5);
    // camera.zoom = 1;

    camera.position.set(-10.94, 5.64, 1.56);
    camera.zoom = 1.00;
    // controls.target.set(0.00, 0.00, 0.00);
    camera.updateProjectionMatrix();

    scene = new THREE.Scene();
    scene.background = new THREE.Color( 0x0a0a0a );

    // Renderer
    renderer = new THREE.WebGLRenderer({antialias: false});
    renderer.setSize(screenResolution.x, screenResolution.y);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    document.body.appendChild(renderer.domElement);

    // Light
    light = new THREE.DirectionalLight(0xffffff, 10.5);
    light.position.set(0, 10, 5);
    scene.add(light);

    scene.add(new THREE.AmbientLight(0xffffff, 0.5));

    // Controller
    controls = new OrbitControls(camera, renderer.domElement);
    controls.update();

    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));


    // Bloom pass
    shaderPasses.bloomPass = new UnrealBloomPass(
        screenResolution, 
        0.23,    // strength
        0.18,    // radius
        0.0,    // threshold
    );

    shaderPasses.chromatic = new ShaderPass(RGBShiftShader);
    shaderPasses.pix = new ShaderPass(Pixelize);

    shaderPasses.bloomPass.enabled = true;
    shaderPasses.chromatic.enabled = false;
    shaderPasses.pix.enabled = true;

    const blueNoiseTexture = textureLoader.load('textures/128x128.png');
    blueNoiseTexture.wrapS  = THREE.RepeatWrapping;
    blueNoiseTexture.wrapT  = THREE.RepeatWrapping;

    const paletteTexture = textureLoader.load('textures/midnight-ablaze-8x.png');
    paletteTexture.minFilter = THREE.NearestFilter;
    paletteTexture.magFilter = THREE.NearestFilter;
    paletteTexture.wrapS = THREE.ClampToEdgeWrapping;
    paletteTexture.wrapT = THREE.ClampToEdgeWrapping;

    // Ordered Dither
    shaderPasses.bayerDither = new ShaderPass(DitherShader);
    shaderPasses.bayerDither.uniforms['matrixSize'].value = 8.0;
    shaderPasses.bayerDither.uniforms['bias'].value = 0.0;
    shaderPasses.bayerDither.uniforms['resolution'].value = new THREE.Vector2(window.innerWidth, window.innerHeight);
    shaderPasses.bayerDither.enabled = false;

    // Blue Noise
    shaderPasses.blueNoise = new ShaderPass(BlueNoiseDither);
    shaderPasses.blueNoise.uniforms['bias'].value = 0.0;
    shaderPasses.blueNoise.uniforms['noise'].value = blueNoiseTexture;
    shaderPasses.blueNoise.enabled = false;

    // Color Quantization
    // Beeteedubs, instead it got some weird blocky pixel size...
    shaderPasses.colorQua = new ShaderPass(ColorQuantization);
    shaderPasses.colorQua.uniforms['colorNum'].value = 2.0;
    shaderPasses.colorQua.uniforms['resolution'].value = new THREE.Vector4(window.innerWidth, window.innerHeight, 1 / window.innerWidth, 1 / window.innerHeight);
    shaderPasses.colorQua.uniforms['pixelSize'].value = 1.0;
    shaderPasses.colorQua.enabled = false;

    // Cathode Ray Tube
    shaderPasses.cRayTube = new ShaderPass(CathodeRayTube);
    shaderPasses.cRayTube.uniforms['colorNum'].value = 16.0;
    shaderPasses.cRayTube.uniforms['resolution'].value = new THREE.Vector4(window.innerWidth, window.innerHeight, 1 / window.innerWidth, 1 / window.innerHeight);
    shaderPasses.cRayTube.uniforms['pixelSize'].value = 4.0;
    shaderPasses.cRayTube.uniforms['maskIntensity'].value = 0.7;
    shaderPasses.cRayTube.uniforms['blending'].value = true;
    shaderPasses.cRayTube.enabled = false;

    shaderPasses.crtAd = new ShaderPass(CRTad);
    shaderPasses.crtAd.uniforms['colorNum'].value = 16.0;
    shaderPasses.crtAd.uniforms['resolution'].value = new THREE.Vector2(window.innerWidth, window.innerHeight);
    shaderPasses.crtAd.uniforms['pixelSize'].value = 4.0;
    shaderPasses.crtAd.uniforms['blending'].value = true;
    shaderPasses.crtAd.enabled = false;

    shaderPasses.ascii = new ShaderPass(AsciiShader);
    shaderPasses.ascii.uniforms['resolution'].value = new THREE.Vector2(window.innerWidth, window.innerHeight);
    shaderPasses.ascii.enabled = false;

    shaderPasses.hue = new ShaderPass(HueLightness);
    shaderPasses.hue.uniforms['resolution'].value = new THREE.Vector2(window.innerWidth, window.innerHeight);
    shaderPasses.hue.uniforms['colorNum'].value = 16.0;
    shaderPasses.hue.enabled = false;

    shaderPasses.pal = new ShaderPass(ColorPalette);
    shaderPasses.pal.uniforms['resolution'].value = new THREE.Vector2(window.innerWidth, window.innerHeight);
    shaderPasses.pal.uniforms['colorNum'].value = 16.0;
    shaderPasses.pal.uniforms['palette'].value = paletteTexture;
    shaderPasses.pal.enabled = false;

    shaderPasses.lego = new ShaderPass(LegoShader);
    shaderPasses.lego.uniforms['resolution'].value = new THREE.Vector2(window.innerWidth, window.innerHeight);
    shaderPasses.lego.uniforms['pixelSize'].value = 16.0;
    shaderPasses.lego.uniforms['lightPosition'].value = new THREE.Vector2(0.8, 0.8);
    shaderPasses.lego.enabled = false;

    shaderPasses.pix = new ShaderPass(Pixelize);
    shaderPasses.pix.uniforms['resolution'].value = new THREE.Vector4(window.innerWidth, window.innerHeight, 1 / window.innerWidth, 1 / window.innerHeight);
    shaderPasses.pix.uniforms['pixelSize'].value = 4.0;
    shaderPasses.pix.enabled = true;


    // Add the pass to the effect composer
    composer.addPass(shaderPasses.bloomPass);
    composer.addPass(shaderPasses.chromatic);
    composer.addPass(shaderPasses.bayerDither);
    composer.addPass(shaderPasses.blueNoise);
    composer.addPass(shaderPasses.colorQua);
    composer.addPass(shaderPasses.cRayTube);
    composer.addPass(shaderPasses.crtAd);
    composer.addPass(shaderPasses.ascii);
    composer.addPass(shaderPasses.hue);
    composer.addPass(shaderPasses.pal);
    composer.addPass(shaderPasses.lego);
    composer.addPass(shaderPasses.pix);
    

    const outputPass = new OutputPass();
    composer.addPass(outputPass);

    const particlesGeometry = new THREE.BufferGeometry();
    const particlesCount = 200;
    const positions = new Float32Array( particlesCount * 3 );

    for ( let i = 0; i < particlesCount * 3; i += 3 ) {

        const radius = 50 + Math.random() * 10;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI;

        positions[ i ] = radius * Math.sin( phi ) * Math.cos( theta );
        positions[ i + 1 ] = radius * Math.cos( phi );
        positions[ i + 2 ] = radius * Math.sin( phi ) * Math.sin( theta );

    }

    particlesGeometry.setAttribute( 'position', new THREE.BufferAttribute( positions, 3 ) );

    const particlesMaterial = new THREE.PointsMaterial( {
        color: 0xffffff,
        size: 0.5,
        sizeAttenuation: true
    } );

    const particles = new THREE.Points( particlesGeometry, particlesMaterial );
    scene.add( particles );

    const gridHelper = new THREE.GridHelper( 40, 20, 0x444444, 0x222222 );
    gridHelper.position.y = 0;
    scene.add( gridHelper );

    const discTexture = textureLoader.load('textures/sp.jpg'); // Add your image path here
    discTexture.colorSpace = THREE.SRGBColorSpace;

    const discGeometry = new THREE.CircleGeometry(2.5, 32);
    const discMaterial = new THREE.MeshStandardMaterial({
        map: discTexture,
        side: THREE.DoubleSide
    });

    disc = new THREE.Mesh(discGeometry, discMaterial);
    disc.rotation.x = -Math.PI / 2;  // rotate to be horizontal
    disc.position.set(0.7, 0.8, 0.004);   // slightly above ground to avoid z-fighting
    disc.castShadow = true;
    disc.receiveShadow = true;
    scene.add(disc);

    loadGLTFModel('models/miku.gltf', new THREE.Vector3(-7.7, 3.2, 1), new THREE.Euler(0, -Math.PI / 2, 0));
    loadGLTFModel('models/cd-player.gltf', new THREE.Vector3(-1, 3, 0));
    
    setupGUI();

    window.addEventListener('resize', onWindowResize, false);
}

function loadGLTFModel(url: string, position: THREE.Vector3, rotation: THREE.Euler = new THREE.Euler(0, 0, 0)) {
    gltfLoader.load(url, (gltf) => {
        const root = gltf.scene;

        scene.add(root);


        const box = new THREE.Box3().setFromObject(root);
        const size = box.getSize(new THREE.Vector3());

        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 10.0 / maxDim;
        root.scale.multiplyScalar(scale);

        const newBox = new THREE.Box3().setFromObject(root);
        const newCenter = newBox.getCenter(new THREE.Vector3());
        root.position.sub(newCenter).add(position);

        root.rotation.copy(rotation);
    });
}

function setupGUI() {
    const gui = new GUI();

    const cameraInfo = {
        posX: 0,
        posY: 0,
        posZ: 0,
        targetX: 0,
        targetY: 0,
        targetZ: 0,
        zoom: 1,
    };

    const infoFolder = gui.addFolder('Camera Info (Read-Only)');
    infoFolder.add(cameraInfo, 'posX').name('Camera X').listen().disable();
    infoFolder.add(cameraInfo, 'posY').name('Camera Y').listen().disable();
    infoFolder.add(cameraInfo, 'posZ').name('Camera Z').listen().disable();
    infoFolder.add(cameraInfo, 'targetX').name('Target X').listen().disable();
    infoFolder.add(cameraInfo, 'targetY').name('Target Y').listen().disable();
    infoFolder.add(cameraInfo, 'targetZ').name('Target Z').listen().disable();
    infoFolder.add(cameraInfo, 'zoom').name('Zoom').listen().disable();

    infoFolder.add({
        copyValues: () => {
            const values = `camera.position.set(${camera.position.x.toFixed(2)}, ${camera.position.y.toFixed(2)}, ${camera.position.z.toFixed(2)});
                            camera.zoom = ${camera.zoom.toFixed(2)};
                            controls.target.set(${controls.target.x.toFixed(2)}, ${controls.target.y.toFixed(2)}, ${controls.target.z.toFixed(2)});`;
            navigator.clipboard.writeText(values);
            console.log('Copied to clipboard:\n' + values);
        }
    }, 'copyValues').name('Copy Values');

    infoFolder.open();

    function updateCameraInfo() {
        cameraInfo.posX = parseFloat(camera.position.x.toFixed(2));
        cameraInfo.posY = parseFloat(camera.position.y.toFixed(2));
        cameraInfo.posZ = parseFloat(camera.position.z.toFixed(2));
        cameraInfo.targetX = parseFloat(controls.target.x.toFixed(2));
        cameraInfo.targetY = parseFloat(controls.target.y.toFixed(2));
        cameraInfo.targetZ = parseFloat(controls.target.z.toFixed(2));
        cameraInfo.zoom = parseFloat(camera.zoom.toFixed(2));
    }

    (window as any).updateCameraInfo = updateCameraInfo;

    gui.add(settings, 'enableBloom').name('Enable Bloom').onChange((value: boolean) => {
        if (shaderPasses.bloomPass) {
            shaderPasses.bloomPass.enabled = value;
        }
        if (value) {
            bloomFolder.show();
        } else {
            bloomFolder.hide();
        }
    });

    gui.add(settings, 'enableChrome').name("Enable RGB").onChange((value: boolean) => {
        if (shaderPasses.chromatic) {
            shaderPasses.chromatic.enabled = value;
        }

        if (value) {
            chromeFolder.show();
        } else {
            chromeFolder.hide();
        }
    })

    gui.add(settings, 'enablePixelize').name("Enable Pixelization").onChange((value: boolean) => {
        if (shaderPasses.pix) {
            shaderPasses.pix.enabled = value;
        }

        if (value) {
            pixFolder.show();
        } else {
            pixFolder.hide();
        }
    })

    const bloomFolder = gui.addFolder('Unreal Bloom');
    bloomFolder.add(shaderPasses.bloomPass!, 'strength', 0.0, 3.0, 0.01).name('Strength');
    bloomFolder.add(shaderPasses.bloomPass!, 'radius', 0.0, 1.0, 0.01).name('Radius');
    bloomFolder.add(shaderPasses.bloomPass!, 'threshold', 0.0, 1.0, 0.01).name('Threshold');
    bloomFolder.hide();

    const chromeFolder = gui.addFolder("Chromatic Aberration");
    chromeFolder.add(shaderPasses.chromatic!.uniforms.amount, 'value', 0.0, 0.01, 0.0001).name('Amount');
    chromeFolder.add(shaderPasses.chromatic!.uniforms.angle, 'value', 0.0, 180, 1).name('Angle');
    chromeFolder.hide(); 

    const pixFolder = gui.addFolder("Pixelize");
    pixFolder.add(shaderPasses.pix!.uniforms.pixelSize, 'value', [2.0, 4.0, 8.0, 16.0]).name("Pixel Size");
    pixFolder.hide();

    const bayerFolder = gui.addFolder('Bayer Dither');
    bayerFolder.add(shaderPasses.bayerDither!.uniforms.bias, 'value', 0.0, 1.0, 0.01).name('Bias');
    bayerFolder.add(shaderPasses.bayerDither!.uniforms.matrixSize, 'value', [2, 4, 8]).name('Matrix Size');
    bayerFolder.hide(); 
    
    const blueFolder = gui.addFolder('Blue Noise Dither');
    blueFolder.add(shaderPasses.blueNoise!.uniforms.bias, 'value', 0.0, 1.0, 0.01).name('Bias');
    blueFolder.hide();

    const colorQuaFolder = gui.addFolder('Color Quantization');
    colorQuaFolder.add(shaderPasses.colorQua!.uniforms.colorNum, 'value', [2.0, 4.0, 8.0, 16.0]).name("Color Number");
    colorQuaFolder.add(shaderPasses.colorQua!.uniforms.pixelSize, 'value', [1.0, 2.0, 4.0, 8.0, 16.0]).name("Pixel Size");
    colorQuaFolder.hide();

    const crtFolder = gui.addFolder('Cathode Ray Tube');
    crtFolder.add(shaderPasses.cRayTube!.uniforms.colorNum, 'value', [2.0, 4.0, 8.0, 16.0]).name("Color Number");
    crtFolder.add(shaderPasses.cRayTube!.uniforms.pixelSize, 'value', [4.0, 8.0, 16.0, 32.0]).name("Pixel Size");
    crtFolder.add(shaderPasses.cRayTube!.uniforms.maskIntensity, 'value', 0.0, 1.0, 0.01).name('Mask Intensity');
    crtFolder.add(shaderPasses.cRayTube!.uniforms.blending, 'value', [true, false]).name("Blending");
    crtFolder.hide();

    const crtAdFolder = gui.addFolder('CRT with addition');
    crtAdFolder.add(shaderPasses.crtAd!.uniforms.colorNum, 'value', [2.0, 4.0, 8.0, 16.0]).name("Color Number");
    crtAdFolder.add(shaderPasses.crtAd!.uniforms.pixelSize, 'value', [4.0, 8.0, 16.0, 32.0]).name("Pixel Size");
    crtAdFolder.hide();

    const hueFolder = gui.addFolder('Lightness');
    hueFolder.add(shaderPasses.hue!.uniforms.colorNum, 'value', [2.0, 4.0, 8.0, 16.0]).name("Color Number");
    hueFolder.hide();

    const palFolder = gui.addFolder('Palette');
    palFolder.add(shaderPasses.pal!.uniforms.colorNum, 'value', [2.0, 4.0, 8.0, 16.0]).name("Color Number");
    palFolder.hide();

    const legoFolder = gui.addFolder("Lego Shader");
    legoFolder.add(shaderPasses.lego!.uniforms.pixelSize, 'value', [8.0, 16.0, 32.0, 64.0]).name("Pixel Size");
    legoFolder.hide();

    

    // Shader selection dropdown
    gui.add(settings, 'activeShader', {
        'None': 'none',
        'Bayer Dither': 'bayerDither',
        'Blue Noise': 'blueNoise',
        'Color Quantization': 'colorQua',
        'Cathode Ray Tube': 'cRayTube',
        'CRT with addition': 'crtAd',
        'Ascii Shader': 'ascii',
        'Hue Lightness': 'hue',
        'Color Palettes': 'pal',
        'Lego Shader': 'lego',
    }).name('Post Effect').onChange((value: string) => {
        // Only disable non-bloom passes
        shaderPasses.bayerDither!.enabled = false;
        shaderPasses.blueNoise!.enabled = false;
        shaderPasses.colorQua!.enabled = false;
        shaderPasses.cRayTube!.enabled = false;
        shaderPasses.crtAd!.enabled = false;
        shaderPasses.ascii!.enabled = false;
        shaderPasses.hue!.enabled = false;
        shaderPasses.pal!.enabled = false;
        shaderPasses.lego!.enabled = false;

        if (value !== 'none' && shaderPasses[value as keyof typeof shaderPasses]) {
            shaderPasses[value as keyof typeof shaderPasses]!.enabled = true;
        }

        bayerFolder.hide();
        blueFolder.hide();
        colorQuaFolder.hide();
        crtFolder.hide();
        crtAdFolder.hide();
        hueFolder.hide();
        palFolder.hide();
        legoFolder.hide();

        if (value === 'bayerDither') {
            bayerFolder.show();
        } else if (value === 'blueNoise') {
            blueFolder.show();
        } else if (value === 'colorQua') {
            colorQuaFolder.show();
        } else if (value === 'cRayTube') {
            crtFolder.show();
        } else if (value === 'crtAd') {
            crtAdFolder.show();
        } else if (value === 'hue') {
            hueFolder.show();
        } else if (value === 'pal') {
            palFolder.show();
        } else if (value === 'lego') {
            legoFolder.show();
        }
        
    });
}

function onWindowResize() {
    camera.updateProjectionMatrix();
    
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);


    if (shaderPasses.bayerDither) {
        shaderPasses.bayerDither.uniforms.resolution.value.set(window.innerWidth, window.innerHeight);
    } 
    if (shaderPasses.colorQua ) {
        shaderPasses.colorQua.uniforms.resolution.value.set(window.innerWidth, window.innerHeight, 1 / window.innerWidth, 1 / window.innerHeight);
    } 
    if (shaderPasses.cRayTube) {
        shaderPasses.cRayTube.uniforms.resolution.value.set(window.innerWidth, window.innerHeight, 1 / window.innerWidth, 1 / window.innerHeight);
    }
    if (shaderPasses.crtAd) {
        shaderPasses.crtAd.uniforms.resolution.value.set(window.innerWidth, window.innerHeight); // Added resize handling for crtAd
    }
    if (shaderPasses.ascii) {
        shaderPasses.ascii.uniforms.resolution.value.set(window.innerWidth, window.innerHeight);
    }
    if (shaderPasses.hue) {
        shaderPasses.hue.uniforms.resolution.value.set(window.innerWidth, window.innerHeight);
    }
    if (shaderPasses.pal) {
        shaderPasses.pal.uniforms.resolution.value.set(window.innerWidth, window.innerHeight);
    }
    if (shaderPasses.lego) {
        shaderPasses.lego.uniforms.resolution.value.set(window.innerWidth, window.innerHeight);
    }
    // if (shaderPasses.pix) {
    //     shaderPasses.pix.uniforms.resolution.value.set(window.innerWidth, window.innerHeight, 1 / window.innerWidth, 1 / window.innerHeight);
    // }
}

function animate() {
    requestAnimationFrame(animate);

    

    const elapsedTime = clock.getElapsedTime();

    if (shaderPasses.crtAd) {
        shaderPasses.crtAd.uniforms.time.value = elapsedTime;
    }

    if ((window as any).updateCameraInfo) {
        (window as any).updateCameraInfo();
    }

    disc.rotation.z += 0.01;
    controls.update();

    composer.render();

    
}



