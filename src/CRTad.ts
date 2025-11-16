const CRTad = {
    name: 'CRTad',
    uniforms: {
        'tDiffuse': {value: null},
        'pixelSize': {value: null},
        'colorNum': {value: null},
        'resolution': {value: null},
        'blending': {value: null},
        'curve': {value: null},
        'time': {value: 0.0},
    },

    vertexShader: /* glsl */`
        varying vec2 vUv;

        void main() {

            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,

    fragmentShader: /* glsl */`
        precision highp float;

        varying vec2 vUv;

        uniform sampler2D tDiffuse;
        uniform float colorNum;
        uniform float pixelSize;
        uniform bool blending;
        uniform vec2 resolution;
        uniform float time;
        uniform float curve;

        const float bayerMatrix8x8[64] = float[64](
            0.0/ 64.0, 48.0/ 64.0, 12.0/ 64.0, 60.0/ 64.0,  3.0/ 64.0, 51.0/ 64.0, 15.0/ 64.0, 63.0/ 64.0,
            32.0/ 64.0, 16.0/ 64.0, 44.0/ 64.0, 28.0/ 64.0, 35.0/ 64.0, 19.0/ 64.0, 47.0/ 64.0, 31.0/ 64.0,
            8.0/ 64.0, 56.0/ 64.0,  4.0/ 64.0, 52.0/ 64.0, 11.0/ 64.0, 59.0/ 64.0,  7.0/ 64.0, 55.0/ 64.0,
            40.0/ 64.0, 24.0/ 64.0, 36.0/ 64.0, 20.0/ 64.0, 43.0/ 64.0, 27.0/ 64.0, 39.0/ 64.0, 23.0/ 64.0,
            2.0/ 64.0, 50.0/ 64.0, 14.0/ 64.0, 62.0/ 64.0,  1.0/ 64.0, 49.0/ 64.0, 13.0/ 64.0, 61.0/ 64.0,
            34.0/ 64.0, 18.0/ 64.0, 46.0/ 64.0, 30.0/ 64.0, 33.0/ 64.0, 17.0/ 64.0, 45.0/ 64.0, 29.0/ 64.0,
            10.0/ 64.0, 58.0/ 64.0,  6.0/ 64.0, 54.0/ 64.0,  9.0/ 64.0, 57.0/ 64.0,  5.0/ 64.0, 53.0/ 64.0,
            42.0/ 64.0, 26.0/ 64.0, 38.0/ 64.0, 22.0/ 64.0, 41.0/ 64.0, 25.0/ 64.0, 37.0/ 64.0, 21.0 / 64.0
        );

        float random(vec2 c) {
            return fract(sin(dot(c.xy, vec2(12.9898, 78.233))) * 43758.5453);
        }

        float noise(in vec2 st) {
            vec2 i = floor(st);
            vec2 f = fract(st);

            float a = random(i);
            float b = random(i + vec2(1.0, 0.0));
            float c = random(i + vec2(0.0, 1.0));
            float d = random(i + vec2(1.0, 1.0));

            vec2 u = f * f * (3.0 - 2.0 * f);

            return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
        }

        vec3 dither(vec2 vUv, vec3 color) {
            int x = int(vUv.x * resolution.x) % 8;
            int y = int(vUv.y * resolution.y) % 8;
            float threshold = bayerMatrix8x8[y * 8 + x];

            color.rgb += threshold * 0.6;
            color.r = floor(color.r * (colorNum - 1.0) + 0.5) / (colorNum - 1.0);
            color.g = floor(color.g * (colorNum - 1.0) + 0.5) / (colorNum - 1.0);
            color.b = floor(color.b * (colorNum - 1.0) + 0.5) / (colorNum - 1.0);

            return color;
        }

        const float MASK_BORDER = .9;
        const float MASK_INTENSITY = 0.6;
        const float SPREAD = 0.0025;


        void main() {
            vec2 uv = vUv;

            float shake = (noise(vec2(uv.y) * sin(time * 400.0) * 100.0) - 0.5) * 0.0025;
            uv.x += shake * 1.5;

            // vec2 curveUV = uv * 2.0 - 1.0;
            // vec2 offset = curveUV.yx * curve;
            // curveUV += curveUV * offset * offset;
            // curveUV = curveUV * 0.5 + 0.5;

            vec2 pixel = uv * resolution;
            vec2 coord = pixel / pixelSize;
            vec2 subcoord = coord * vec2(3, 1);
            vec2 cellOffset = vec2(0, mod(floor(coord.x), 3.0) * 0.5);

            float ind = mod(floor(subcoord.x), 3.0);
            vec3 maskColor = vec3(ind == 0.0, ind == 1.0, ind == 2.0) * 2.0;

            vec2 cellUv = fract(subcoord + cellOffset) * 2.0 - 1.0;
            vec2 border = 1.0 - cellUv * cellUv * MASK_BORDER;
            maskColor.rgb *= border.x * border.y;

            vec2 rgbCellUv = floor(coord + cellOffset) * pixelSize / resolution;

            vec4 color = vec4(1.0);
            color.r = texture2D(tDiffuse, rgbCellUv + SPREAD).r;
            color.g = texture2D(tDiffuse, rgbCellUv).g;
            color.b = texture2D(tDiffuse, rgbCellUv - SPREAD).b;

            color.rgb = dither(rgbCellUv, color.rgb);

            if(blending) {
                color.rgb *= 1.0 + (maskColor - 1.0) * MASK_INTENSITY;
            } else {
                color.rgb *= maskColor;
            }

            float lines = sin(uv.y * 2150.0 + time * 100.0);
            lines = mix(0.9, 1.0, lines);
            color.rgb *= lines;

            // vec2 edge = smoothstep(0., 0.02, curveUV)*(1.-smoothstep(1.-0.02, 1., curveUV));
            // color.rgb *= edge.x * edge.y;

            gl_FragColor = color;
        }`,
};

export {CRTad};