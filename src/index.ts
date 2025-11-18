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
import { UnrealBloomPass} from 'three/examples/jsm/Addons.js';
import { RGBShiftShader } from 'three/examples/jsm/Addons.js';
import { CRTad } from './CRTad';
import { AsciiShader } from './AsciiShader';
import { HueLightness } from './HueLightness';
import { ColorPalette } from './ColorPalette';

const clock = new THREE.Clock();


let camera: THREE.OrthographicCamera;
let scene: THREE.Scene;
let renderer: THREE.WebGLRenderer
let controls: OrbitControls;
let light: THREE.DirectionalLight;
let composer: EffectComposer;

const shaderPasses = {
    bloomPass: null as UnrealBloomPass | null,
    chromatic: null as ShaderPass | null,
    bayerDither: null as ShaderPass | null,
    blueNoise: null as ShaderPass | null,
    colorQua: null as ShaderPass | null,
    cRayTube: null as ShaderPass | null,
    crtAd: null as ShaderPass | null,
    ascii: null as ShaderPass | null,
    hue: null as ShaderPass | null,
    pal: null as ShaderPass | null,
};

const settings = {
    activeShader: 'none',
    enableBloom: false,
    enableChrome: false,
}


init()
animate()

function init() {

    let screenResolution = new THREE.Vector2(window.innerWidth, window.innerHeight)

    const aspect = window.innerWidth / window.innerHeight;
    const frustumSize = 10;
    camera = new THREE.OrthographicCamera(
        frustumSize * aspect / -2,  // left
        frustumSize * aspect / 2,   // right
        frustumSize / 2,            // top
        frustumSize / -2,           // bottom
        0.01,                        // near
        500  )

    camera.position.set(5, 5, 5);
    camera.zoom = 3;
    camera.updateProjectionMatrix();

    scene = new THREE.Scene();
    // scene.background = new THREE.Color(0x151729);
    scene.background = new THREE.Color("#3386E0");

    // Renderer
    renderer = new THREE.WebGLRenderer({antialias: false});
    renderer.setSize(screenResolution.x, screenResolution.y);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    document.body.appendChild(renderer.domElement);

    // Light
    light = new THREE.DirectionalLight(0xffffff, 10.5);
    light.position.set(0, 10, 5);
    scene.add(light);

    scene.add(new THREE.AmbientLight(0xffffff, 0.25));

    // Controller
    controls = new OrbitControls(camera, renderer.domElement);
    controls.update();

    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));


    // Bloom pass
    shaderPasses.bloomPass = new UnrealBloomPass(
        screenResolution, 
        1.0,    // strength
        0.5,    // radius
        0.9,    // threshold
    );

    shaderPasses.chromatic = new ShaderPass(RGBShiftShader);

    shaderPasses.bloomPass.enabled = false;
    shaderPasses.chromatic.enabled = false;

    // Ordered Dither
    shaderPasses.bayerDither = new ShaderPass(DitherShader);
    shaderPasses.bayerDither.uniforms['matrixSize'].value = 8.0;
    shaderPasses.bayerDither.uniforms['bias'].value = 0.0;
    shaderPasses.bayerDither.uniforms['resolution'].value = new THREE.Vector2(window.innerWidth, window.innerHeight);
    shaderPasses.bayerDither.enabled = false;

    const textureLoader = new THREE.TextureLoader();
    const blueNoiseTexture = textureLoader.load('textures/128x128.png');
    blueNoiseTexture.wrapS  = THREE.RepeatWrapping;
    blueNoiseTexture.wrapT  = THREE.RepeatWrapping;

    const paletteTexture = textureLoader.load('textures/fading-16-8x.png');
    paletteTexture.minFilter = THREE.NearestFilter;
    paletteTexture.magFilter = THREE.NearestFilter;
    paletteTexture.wrapS = THREE.ClampToEdgeWrapping;
    paletteTexture.wrapT = THREE.ClampToEdgeWrapping;

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
    

    const outputPass = new OutputPass();
    composer.addPass(outputPass);

    { // Object
        let mesh = new THREE.Mesh(
            new THREE.TorusKnotGeometry(1, 0.25, 128, 100),
            new THREE.MeshStandardMaterial({color:'#58A4FE'}),
        )
        scene.add(mesh)
    }
            
    setupGUI();

    window.addEventListener('resize', onWindowResize, false);
}

function setupGUI() {
    const gui = new GUI();

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

    const bloomFolder = gui.addFolder('Unreal Bloom');
    bloomFolder.add(shaderPasses.bloomPass!, 'strength', 0.0, 3.0, 0.01).name('Strength');
    bloomFolder.add(shaderPasses.bloomPass!, 'radius', 0.0, 1.0, 0.01).name('Radius');
    bloomFolder.add(shaderPasses.bloomPass!, 'threshold', 0.0, 1.0, 0.01).name('Threshold');

    const chromeFolder = gui.addFolder("Chromatic Aberration");
    chromeFolder.add(shaderPasses.chromatic!.uniforms.amount, 'value', 0.0, 0.01, 0.0001).name('Amount');
    chromeFolder.add(shaderPasses.chromatic!.uniforms.angle, 'value', 0.0, 180, 1).name('Angle');
    chromeFolder.hide(); 

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
    palFolder.add(shaderPasses.hue!.uniforms.colorNum, 'value', [2.0, 4.0, 8.0, 16.0]).name("Color Number");
    palFolder.hide();

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
        } else if (value === 'hue') {
            palFolder.show();
        }
        
    });
}

function onWindowResize() {

    const aspect = window.innerWidth / window.innerHeight;
    const frustumSize = 10;
    
    camera.left = frustumSize * aspect / -2;
    camera.right = frustumSize * aspect / 2;
    camera.top = frustumSize / 2;
    camera.bottom = frustumSize / -2;
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
}

function animate() {
    requestAnimationFrame(animate);

    const elapsedTime = clock.getElapsedTime();

    if (shaderPasses.crtAd) {
        shaderPasses.crtAd.uniforms.time.value = elapsedTime;
    }
    controls.update();
    composer.render();
}