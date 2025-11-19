const LegoShader = {
    uniforms: {
        'tDiffuse': {value: null},
        'resolution': {value: null},
        'pixelSize': {value: null},
        'lightPosition': {value: null},
    },

    vertexShader: /* glsl */`
        varying vec2 vUv;

        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); 
        }

        
    `,
    fragmentShader: /* glsl */ `
        varying vec2 vUv;
        uniform float pixelSize;
        uniform vec2 resolution;
        uniform vec2 lightPosition;
        uniform sampler2D tDiffuse;

        float random(vec2 st) {
            return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
        }

        vec3 rgbToHsv(vec3 c) {
            vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
            vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
            vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
            float d = q.x - min(q.w, q.y);
            float e = 1.0e-10;
            return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
        }

        // Function to convert HSV back to RGB
        vec3 hsvToRgb(vec3 c) {
            vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
            vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
            return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
        }

        const float colorNum = 16.0;
        const float MASK_BORDER = 1.5;
        const float MASK_INTENSITY = 1.5;

        void main() {
            vec2 normalizedPixelSize = pixelSize / resolution;
            vec2 uvPixel = normalizedPixelSize * floor(vUv / normalizedPixelSize);
            vec4 color = texture(tDiffuse, uvPixel);

            color.r = floor(color.r * (colorNum - 1.0) + 0.5) / (colorNum - 1.0);
            color.g = floor(color.g * (colorNum - 1.0) + 0.5) / (colorNum - 1.0);
            color.b = floor(color.b * (colorNum - 1.0) + 0.5) / (colorNum - 1.0);

            color.rgb = clamp(color.rgb, 0.01, 0.95);
            
            vec2 cellPosition = floor(vUv / normalizedPixelSize);
            vec2 cellUV = fract(vUv / normalizedPixelSize);
            
            float lighting = dot(normalize(cellUV - vec2(0.5)), lightPosition) * 0.7;
            float dis = abs(distance(cellUV, vec2(0.5)) * 2.0 - 0.5);
            color.rgb *= smoothstep(0.1,0.0,dis) * lighting + 1.0;

            vec2 centeredCellUV = cellUV * 2.0 - 1.0;
            float mask = 1.0; 
            vec2 border = 1.05 - pow(centeredCellUV, vec2(8.0)) * MASK_BORDER;
            mask *= border.x * border.y;
            float maskStrength = smoothstep(0.0, 0.8, mask);
            color.rgb *=  0.8 + (maskStrength * 0.1);


            float hueShift = random(cellPosition) * 0.02;
            vec3 hsv = rgbToHsv(color.rgb);
            hsv.x += hueShift;
            color.rgb = hsvToRgb(hsv);
            
            gl_FragColor = color;
        }`,
};

export {LegoShader};