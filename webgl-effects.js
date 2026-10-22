(() => {
  'use strict';

  const STRIDE = 8;

  function shader(gl, type, source) {
    const value = gl.createShader(type);
    gl.shaderSource(value, source);
    gl.compileShader(value);
    if (!gl.getShaderParameter(value, gl.COMPILE_STATUS)) {
      console.warn('WebGL shader unavailable:', gl.getShaderInfoLog(value));
      gl.deleteShader(value);
      return null;
    }
    return value;
  }

  function create(canvas) {
    const gl = canvas.getContext('webgl', {
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: false,
    });
    if (!gl) return null;

    const vertex = shader(gl, gl.VERTEX_SHADER, `
      attribute vec2 a_position;
      attribute vec4 a_color;
      attribute float a_size;
      attribute float a_shape;
      uniform vec2 u_resolution;
      varying vec4 v_color;
      varying float v_shape;
      void main() {
        vec2 clip = (a_position / u_resolution) * 2.0 - 1.0;
        gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
        gl_PointSize = a_size;
        v_color = a_color;
        v_shape = a_shape;
      }
    `);
    const fragment = shader(gl, gl.FRAGMENT_SHADER, `
      precision mediump float;
      varying vec4 v_color;
      varying float v_shape;
      void main() {
        vec2 p = gl_PointCoord * 2.0 - 1.0;
        float radius = length(p);
        float alpha = v_color.a;
        if (v_shape < 0.5) {
          if (radius > 1.0) discard;
          alpha *= smoothstep(1.0, 0.72, radius);
        } else if (v_shape < 1.5) {
          if (radius > 1.0) discard;
          alpha *= (1.0 - radius) * (1.0 - radius);
        } else {
          float angle = atan(p.y, p.x);
          float petals = 0.58 + 0.22 * cos(angle * 6.0);
          if (radius > petals) discard;
          alpha *= smoothstep(petals, petals - 0.16, radius);
          if (radius < 0.22) {
            gl_FragColor = vec4(1.0, 0.78, 0.28, alpha);
            return;
          }
        }
        gl_FragColor = vec4(v_color.rgb, alpha);
      }
    `);
    if (!vertex || !fragment) return null;
    const program = gl.createProgram();
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.warn('WebGL program unavailable:', gl.getProgramInfoLog(program));
      return null;
    }

    const buffer = gl.createBuffer();
    const bytes = STRIDE * Float32Array.BYTES_PER_ELEMENT;
    const locations = {
      position: gl.getAttribLocation(program, 'a_position'),
      color: gl.getAttribLocation(program, 'a_color'),
      size: gl.getAttribLocation(program, 'a_size'),
      shape: gl.getAttribLocation(program, 'a_shape'),
      resolution: gl.getUniformLocation(program, 'u_resolution'),
    };
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    return {
      render(data, count) {
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        if (!count) return;
        gl.useProgram(program);
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, data.subarray(0, count * STRIDE), gl.DYNAMIC_DRAW);
        gl.uniform2f(locations.resolution, canvas.width, canvas.height);
        gl.enableVertexAttribArray(locations.position);
        gl.vertexAttribPointer(locations.position, 2, gl.FLOAT, false, bytes, 0);
        gl.enableVertexAttribArray(locations.color);
        gl.vertexAttribPointer(locations.color, 4, gl.FLOAT, false, bytes, 2 * 4);
        gl.enableVertexAttribArray(locations.size);
        gl.vertexAttribPointer(locations.size, 1, gl.FLOAT, false, bytes, 6 * 4);
        gl.enableVertexAttribArray(locations.shape);
        gl.vertexAttribPointer(locations.shape, 1, gl.FLOAT, false, bytes, 7 * 4);
        gl.drawArrays(gl.POINTS, 0, count);
      },
    };
  }

  function createWorld(canvas) {
    const gl = canvas.getContext('webgl', { alpha: true, antialias: false, depth: false });
    if (!gl) return null;
    const vertex = shader(gl, gl.VERTEX_SHADER, `
      attribute vec2 a_position;
      varying vec2 v_uv;
      void main() {
        v_uv = a_position * 0.5 + 0.5;
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `);
    const fragment = shader(gl, gl.FRAGMENT_SHADER, `
      precision mediump float;
      uniform sampler2D u_world;
      varying vec2 v_uv;
      void main() {
        gl_FragColor = texture2D(u_world, vec2(v_uv.x, 1.0 - v_uv.y));
      }
    `);
    if (!vertex || !fragment) return null;
    const program = gl.createProgram();
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const position = gl.getAttribLocation(program, 'a_position');
    return {
      render(pixels) {
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.useProgram(program);
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.enableVertexAttribArray(position);
        gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, canvas.width, canvas.height, 0,
          gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      },
    };
  }

  globalThis.PixelBloomWebGL = { create, createWorld, STRIDE };
})();
