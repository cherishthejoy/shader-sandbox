const BlueNoiseDither = {
    name: 'BlueNoiseDither',
    uniforms: {
        'tDiffuse': {value: null},
        'noise': {value: null},
        'bias': {value: 0.5},
    },

    vertexShader: `
        varying vec2 vUv;

        void main() {

            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
        
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform sampler2D noise;
        uniform float bias;
        varying vec2 vUv;

        vec3 blueNoiseDither(vec2 vUv, float lum) {
            vec3 color = vec3(0.0);

            float threshold = texture(noise, gl_FragCoord.xy / 128.0).r;

            return lum < threshold + bias ? vec3(0.0) : vec3(1.0);  
        }

        void main() {

            vec4 color = texture(tDiffuse, vUv);

            float lum = dot(vec3(0.2126, 0.7152, 0.0722), color.rgb);

            color.rgb = blueNoiseDither(vUv, lum);

            gl_FragColor = color;
        }
    `
};

export {BlueNoiseDither};