const Pixelize = {
    name: 'Pixelize',
    uniforms: {
        'tDiffuse': {value: null},
        'resolution': {value: null},
        'pixelSize': {value: 4.0},
    },

    vertexShader: /* glsl */ `
        varying vec2 vUv;

        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        } 
    `,
    fragmentShader: /* glsl */ `
        uniform sampler2D tDiffuse;
        uniform vec4 resolution;
        uniform float pixelSize;

        varying vec2 vUv;

        void main() {
            vec2 texSize = resolution.xy;
            vec2 blockCount = texSize / pixelSize;

            vec2 uvBlock = floor(vUv * blockCount);
            vec2 uvPixel = (uvBlock + 0.5) / blockCount;

            vec4 color = texture2D(tDiffuse, uvPixel);

            gl_FragColor = color;
        }`,
};

export {Pixelize};