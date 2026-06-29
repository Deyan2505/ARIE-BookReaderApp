const fragmentShaderSource = `#version 300 es
precision highp float;
out vec4 O;
uniform float time;
uniform vec2 resolution;
uniform vec3 u_color;

#define FC gl_FragCoord.xy
#define R resolution
#define T (time+660.)

float rnd(vec2 p){p=fract(p*vec2(12.9898,78.233));p+=dot(p,p+34.56);return fract(p.x*p.y);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*(3.-2.*f);return mix(mix(rnd(i),rnd(i+vec2(1,0)),u.x),mix(rnd(i+vec2(0,1)),rnd(i+1.),u.x),u.y);}
float fbm(vec2 p){float t=.0,a=1.;for(int i=0;i<5;i++){t+=a*noise(p);p*=mat2(1,-1.2,.2,1.2)*2.;a*=.5;}return t;}

void main(){
  vec2 uv=(FC-.5*R)/R.y;
  vec3 col=vec3(1);
  uv.x+=.25;
  uv*=vec2(2,1);

  float n=fbm(uv*.28-vec2(T*.01,0));
  n=noise(uv*3.+n*2.);

  col.r-=fbm(uv+vec2(0,T*.015)+n);
  col.g-=fbm(uv*1.003+vec2(0,T*.015)+n+.003);
  col.b-=fbm(uv*1.006+vec2(0,T*.015)+n+.006);

  col=mix(col, u_color, dot(col,vec3(.21,.71,.07)));

  col=mix(vec3(.08),col,min(time*.1,1.));
  col=clamp(col,.08,1.);
  O=vec4(col,1);
}`;

const vertexShaderSource = `#version 300 es
precision highp float;
in vec4 position;
void main(){ gl_Position = position; }`;

class SmokeRenderer {
  constructor(canvas, color = [0.83, 0.686, 0.216]) { // gold: #d4af37
    this.canvas = canvas;
    this.gl = canvas.getContext('webgl2');
    this.color = color;
    this.program = null;
    this.uniforms = {};
    if (!this.gl) return;
    this._setup();
    this._initBuffer();
  }

  _compileShader(type, source) {
    const gl = this.gl;
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Shader error:', gl.getShaderInfoLog(shader));
    }
    return shader;
  }

  _setup() {
    const gl = this.gl;
    const vs = this._compileShader(gl.VERTEX_SHADER, vertexShaderSource);
    const fs = this._compileShader(gl.FRAGMENT_SHADER, fragmentShaderSource);
    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(program));
    }
    this.program = program;
    this.uniforms = {
      resolution: gl.getUniformLocation(program, 'resolution'),
      time:       gl.getUniformLocation(program, 'time'),
      u_color:    gl.getUniformLocation(program, 'u_color'),
    };
  }

  _initBuffer() {
    const gl = this.gl;
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,1,-1,-1,1,1,1,-1]), gl.STATIC_DRAW);
    const pos = gl.getAttribLocation(this.program, 'position');
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);
  }

  resize() {
    const dpr = Math.max(1, devicePixelRatio);
    this.canvas.width  = innerWidth  * dpr;
    this.canvas.height = innerHeight * dpr;
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  setColor(hex) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (m) this.color = [parseInt(m[1],16)/255, parseInt(m[2],16)/255, parseInt(m[3],16)/255];
  }

  render(now = 0) {
    const { gl, program, uniforms, canvas, color } = this;
    if (!program) return;
    gl.useProgram(program);
    gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
    gl.uniform1f(uniforms.time, now * 1e-3);
    gl.uniform3fv(uniforms.u_color, color);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}

// Init on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('smoke-canvas');
  if (!canvas) return;

  const renderer = new SmokeRenderer(canvas);
  renderer.resize();
  window.addEventListener('resize', () => renderer.resize());

  let raf;
  const loop = (now) => { renderer.render(now); raf = requestAnimationFrame(loop); };
  loop(0);

  // Expose setColor globally so reader.js can theme-sync if needed
  window.setSmokeColor = (hex) => renderer.setColor(hex);
});
