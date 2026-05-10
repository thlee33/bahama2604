(function(){let e=document.createElement(`link`).relList;if(e&&e.supports&&e.supports(`modulepreload`))return;for(let e of document.querySelectorAll(`link[rel="modulepreload"]`))n(e);new MutationObserver(e=>{for(let t of e)if(t.type===`childList`)for(let e of t.addedNodes)e.tagName===`LINK`&&e.rel===`modulepreload`&&n(e)}).observe(document,{childList:!0,subtree:!0});function t(e){let t={};return e.integrity&&(t.integrity=e.integrity),e.referrerPolicy&&(t.referrerPolicy=e.referrerPolicy),e.crossOrigin===`use-credentials`?t.credentials=`include`:e.crossOrigin===`anonymous`?t.credentials=`omit`:t.credentials=`same-origin`,t}function n(e){if(e.ep)return;e.ep=!0;let n=t(e);fetch(e.href,n)}})();var e=`#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`,t=`#version 300 es
precision highp float;
uniform sampler2D u_particles;
uniform sampler2D u_wind;    // RG16F or RG32F: r=U, g=V
uniform float u_rand_seed;
uniform float u_speed_factor;
uniform float u_camera_height;
uniform float u_drop_rate;
uniform float u_drop_rate_bump;
uniform vec4 u_bounds;  // lonMin, latMin, lonMax, latMax
in vec2 v_uv;
out vec4 fragColor;

float rand(vec2 co) {
  return fract(sin(dot(co + u_rand_seed, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec4 ps = texture(u_particles, v_uv);
  vec2 pos = ps.rg;  // (0..1, 0..1) 
  
  // u_wind texture matches bounding box. Y=0 is North.
  vec2 windUV = vec2(pos.x, 1.0 - pos.y);
  vec2 wind = texture(u_wind, windUV).rg;  // (u, v)

  float speed = length(wind);

  // Position bounds approximate lengths
  float lat = mix(u_bounds[1], u_bounds[3], pos.y);
  float cosLat = cos(radians(lat));

  // Max speed is 10 m/s. dt=1.0 means it moves 10 meters per frame.
  // To get smooth trails across a 8km box, we want ~50-100 meters per frame max.
  // 동적 스케일링: 카메라가 높을 때(축소)는 더 길게 이동해야 보이고, 낮을 때(확대)는 조금만 이동해야 끊기지 않음
  float scale = clamp(u_camera_height / 2000.0, 0.2, 5.0);
  float dt = u_speed_factor * 15.0 * scale; 
  vec2 delta;
  
  float lonSpan = u_bounds[2] - u_bounds[0];
  float latSpan = u_bounds[3] - u_bounds[1];
  
  delta.x = wind.x * dt / (lonSpan * 111000.0 * cosLat);   
  delta.y = wind.y * dt / (latSpan * 111000.0);             

  vec2 newPos = pos + delta;

  // Drop chance
  float speedT = clamp(speed / 20.0, 0.0, 1.0);
  float dropChance = u_drop_rate + speedT * u_drop_rate_bump;
  float drop = step(1.0 - dropChance, rand(pos + vec2(0.1, 0.2)));

  // If particle flows completely out of bounds (0~1), kill it
  if (newPos.x < 0.0 || newPos.x > 1.0 || newPos.y < 0.0 || newPos.y > 1.0) {
    drop = 1.0;
  }

  // Generate random spawn point if dropped
  // Storm surge usually enters from North/East, let's just scatter randomly
  vec2 randPos = vec2(rand(pos + vec2(1.1, 0.3)), rand(pos + vec2(0.5, 1.7)));
  newPos = mix(newPos, randPos, drop);

  fragColor = vec4(newPos, speedT, 1.0);
}`,n=`#version 300 es
precision highp float;
uniform sampler2D u_particles;
uniform float u_particles_res;
uniform mat4 u_viewMatrix;
uniform mat4 u_projMatrix;
uniform float u_camera_height;
uniform vec4 u_bounds;  // lonMin, latMin, lonMax, latMax
out float v_speed;

vec3 lonLatToCartesian(float lon, float lat) {
    float radLon = radians(lon);
    float radLat = radians(lat);
    float cosLat = cos(radLat);
    
    // WGS84 Ellipsoid Radii
    float a = 6378137.0;
    float b = 6356752.314245;
    
    float n = a / sqrt(cosLat * cosLat + (b * b / (a * a)) * sin(radLat) * sin(radLat));
    float x = n * cosLat * cos(radLon);
    float y = n * cosLat * sin(radLon);
    float z = (b * b / (a * a) * n) * sin(radLat);
    return vec3(x, y, z);
}

void main() {
  float idx = float(gl_VertexID);
  float res = u_particles_res;
  vec2 uv = vec2(
    (mod(idx, res) + 0.5) / res,
    (floor(idx / res) + 0.5) / res
  );

  vec4 ps = texture(u_particles, uv);
  v_speed = ps.b;

  float lon = mix(u_bounds[0], u_bounds[2], ps.r);
  float lat = mix(u_bounds[1], u_bounds[3], ps.g);

  vec3 cartesian = lonLatToCartesian(lon, lat);

  gl_Position = u_projMatrix * u_viewMatrix * vec4(cartesian, 1.0);
  // 확대할수록(낮은 고도) 픽셀이 커지도록 하여 가시성 확보
  gl_PointSize = clamp(6000.0 / max(u_camera_height, 100.0), 3.0, 15.0);
}`,r=`#version 300 es
precision highp float;
in float v_speed;
out vec4 fragColor;

vec3 colorRamp(float t) {
  // 진한 파랑(Deep Blue) -> 밝고 쨍한 파랑(Vivid Blue)
  vec3 c0 = vec3(0.00, 0.10, 0.50);
  vec3 c1 = vec3(0.00, 0.40, 0.80);
  vec3 c2 = vec3(0.00, 0.60, 1.00);
  vec3 c3 = vec3(0.20, 0.80, 1.00);
  vec3 c4 = vec3(0.60, 0.90, 1.00);
  vec3 col = mix(c0, c1, smoothstep(0.0, 0.25, t));
  col = mix(col, c2, smoothstep(0.25, 0.50, t));
  col = mix(col, c3, smoothstep(0.50, 0.75, t));
  col = mix(col, c4, smoothstep(0.75, 1.00, t));
  return col;
}

void main() {
  vec2 pc = gl_PointCoord * 2.0 - 1.0;
  float d = dot(pc, pc);
  
  if (d > 1.0) discard;
  
  // Center is opaque, edges are transparent (투명도 전반적으로 높임)
  float a = (1.0 - d * d) * mix(0.7, 1.0, v_speed);
  vec3 c = colorRamp(v_speed);
  fragColor = vec4(c, a);
}`,i=`#version 300 es
precision highp float;
uniform sampler2D u_screen;
uniform float u_opacity;
in vec2 v_uv;
out vec4 fragColor;
void main() {
  fragColor = texture(u_screen, v_uv) * u_opacity;
}`,a=`#version 300 es
precision highp float;
uniform sampler2D u_screen;
in vec2 v_uv;
out vec4 fragColor;
void main() {
  fragColor = texture(u_screen, v_uv);
}`;function o(e,t,n){let r=e.createShader(t);return e.shaderSource(r,n),e.compileShader(r),e.getShaderParameter(r,e.COMPILE_STATUS)?r:(console.error(`Shader error:`,e.getShaderInfoLog(r),`
`,n),null)}function s(e,t,n){let r=e.createProgram();return e.attachShader(r,o(e,e.VERTEX_SHADER,t)),e.attachShader(r,o(e,e.FRAGMENT_SHADER,n)),e.linkProgram(r),e.getProgramParameter(r,e.LINK_STATUS)?r:(console.error(`Link error:`,e.getProgramInfoLog(r)),null)}function c(e,t,n){let r={};for(let i of n)r[i]=e.getUniformLocation(t,i);return r}var l=class{constructor(e,t){if(this.canvas=e,this.viewer=t,this.gl=e.getContext(`webgl2`,{alpha:!0,premultipliedAlpha:!1,antialias:!1}),!this.gl)throw Error(`WebGL2 not supported`);this.numParticles=16384,this.speedFactor=.5,this.dropRate=.003,this.dropRateBump=.01,this.fadeOpacity=.99,this.bounds=[0,0,0,0],this.active=!1,this.initGL(),this._rAF=null,this.viewer.scene.preRender.addEventListener(this.syncCanvas.bind(this))}initGL(){let o=this.gl;o.getExtension(`EXT_color_buffer_float`),o.getExtension(`OES_texture_float_linear`),this.updateProg=s(o,e,t),this.drawProg=s(o,n,r),this.fadeProg=s(o,e,i),this.blitProg=s(o,e,a),this.uUpdate={u_particles:null,u_wind:null,u_rand_seed:null,u_speed_factor:null,u_camera_height:null,u_drop_rate:null,u_drop_rate_bump:null,u_bounds:null},this.uDraw={u_particles:null,u_particles_res:null,u_viewMatrix:null,u_projMatrix:null,u_camera_height:null,u_bounds:null},this.uFade=c(o,this.fadeProg,[`u_screen`,`u_opacity`]),this.uBlit=c(o,this.blitProg,[`u_screen`]);for(let e in this.uUpdate)this.uUpdate[e]=o.getUniformLocation(this.updateProg,e);for(let e in this.uFade)this.uFade[e]=o.getUniformLocation(this.fadeProg,e);for(let e in this.uDraw)this.uDraw[e]=o.getUniformLocation(this.drawProg,e);for(let e in this.uBlit)this.uBlit[e]=o.getUniformLocation(this.blitProg,e);this.quadVAO=o.createVertexArray(),o.bindVertexArray(this.quadVAO);let l=o.createBuffer();o.bindBuffer(o.ARRAY_BUFFER,l),o.bufferData(o.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),o.STATIC_DRAW),o.enableVertexAttribArray(0),o.vertexAttribPointer(0,2,o.FLOAT,!1,0,0),o.bindVertexArray(null),this.emptyVAO=o.createVertexArray(),this._initParticles(),this._sw=this.canvas.width,this._sh=this.canvas.height,this.screenA=this._mkScreenTex(),this.screenB=this._mkScreenTex(),this.fbo=o.createFramebuffer()}_initParticles(){let e=this.gl,t=Math.ceil(Math.sqrt(this.numParticles));this._pRes=t;let n=t*t,r=new Float32Array(n*4);for(let e=0;e<n;e++)r[e*4]=Math.random(),r[e*4+1]=Math.random(),r[e*4+2]=0,r[e*4+3]=1;let i=()=>{let n=e.createTexture();return e.bindTexture(e.TEXTURE_2D,n),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.NEAREST),e.texImage2D(e.TEXTURE_2D,0,e.RGBA32F,t,t,0,e.RGBA,e.FLOAT,r),n};this.pA&&e.deleteTexture(this.pA),this.pB&&e.deleteTexture(this.pB),this.pA=i(),this.pB=i()}_mkScreenTex(){let e=this.gl,t=e.createTexture();return e.bindTexture(e.TEXTURE_2D,t),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),e.texImage2D(e.TEXTURE_2D,0,e.RGBA8,this._sw,this._sh,0,e.RGBA,e.UNSIGNED_BYTE,null),t}async loadWindData(e,t){let[n,r]=await Promise.all([fetch(e),fetch(t)]),i=await n.arrayBuffer(),a=await r.json(),o=new Uint16Array(i);this.bounds=[a.bounds[0][0],a.bounds[0][1],a.bounds[1][0],a.bounds[1][1]];let s=this.gl;this.windTex&&s.deleteTexture(this.windTex),this.windTex=s.createTexture(),s.bindTexture(s.TEXTURE_2D,this.windTex),s.texParameteri(s.TEXTURE_2D,s.TEXTURE_WRAP_S,s.CLAMP_TO_EDGE),s.texParameteri(s.TEXTURE_2D,s.TEXTURE_WRAP_T,s.CLAMP_TO_EDGE),s.texParameteri(s.TEXTURE_2D,s.TEXTURE_MIN_FILTER,s.LINEAR),s.texParameteri(s.TEXTURE_2D,s.TEXTURE_MAG_FILTER,s.LINEAR),s.texImage2D(s.TEXTURE_2D,0,s.RG16F,a.width,a.height,0,s.RG,s.HALF_FLOAT,o)}syncCanvas(){if(!this.active)return;let e=this.viewer.canvas.clientWidth,t=this.viewer.canvas.clientHeight;(this.canvas.width!==e||this.canvas.height!==t)&&(this.canvas.width=e,this.canvas.height=t,this._sw=e,this._sh=t,this.gl.deleteTexture(this.screenA),this.gl.deleteTexture(this.screenB),this.screenA=this._mkScreenTex(),this.screenB=this._mkScreenTex())}start(){this.active||(this.active=!0,this.canvas.style.display=`block`,this.lastTime=performance.now(),this.renderLoop())}stop(){this.active=!1,this.canvas.style.display=`none`,this._rAF&&cancelAnimationFrame(this._rAF)}clear(){let e=this.gl;e.bindFramebuffer(e.FRAMEBUFFER,this.fbo),e.framebufferTexture2D(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,this.screenA,0),e.clearColor(0,0,0,0),e.clear(e.COLOR_BUFFER_BIT),e.framebufferTexture2D(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,this.screenB,0),e.clear(e.COLOR_BUFFER_BIT),e.bindFramebuffer(e.FRAMEBUFFER,null)}renderLoop(){this.active&&(this.windTex&&this.renderFrame(),this._rAF=requestAnimationFrame(this.renderLoop.bind(this)))}renderFrame(){let e=this.gl;e.bindFramebuffer(e.FRAMEBUFFER,this.fbo),e.framebufferTexture2D(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,this.pB,0),e.viewport(0,0,this._pRes,this._pRes),e.disable(e.BLEND),e.useProgram(this.updateProg),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,this.pA),e.uniform1i(this.uUpdate.u_particles,0),e.activeTexture(e.TEXTURE1),e.bindTexture(e.TEXTURE_2D,this.windTex),e.uniform1i(this.uUpdate.u_wind,1),e.uniform1f(this.uUpdate.u_rand_seed,Math.random()),e.uniform1f(this.uUpdate.u_speed_factor,this.speedFactor),e.uniform1f(this.uUpdate.u_drop_rate,this.dropRate),e.uniform1f(this.uUpdate.u_drop_rate_bump,this.dropRateBump);let t=this.viewer.camera.positionCartographic.height;e.uniform1f(this.uUpdate.u_camera_height,t),e.uniform4f(this.uUpdate.u_bounds,this.bounds[0],this.bounds[1],this.bounds[2],this.bounds[3]),e.bindVertexArray(this.quadVAO),e.drawArrays(e.TRIANGLE_STRIP,0,4),[this.pA,this.pB]=[this.pB,this.pA],e.framebufferTexture2D(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,this.screenB,0),e.viewport(0,0,this._sw,this._sh),e.useProgram(this.fadeProg),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,this.screenA),e.uniform1i(this.uFade.u_screen,0),e.uniform1f(this.uFade.u_opacity,this.fadeOpacity),e.drawArrays(e.TRIANGLE_STRIP,0,4),e.enable(e.BLEND),e.blendFunc(e.SRC_ALPHA,e.ONE_MINUS_SRC_ALPHA),e.blendEquation(e.FUNC_ADD),e.useProgram(this.drawProg),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,this.pA),e.uniform1i(this.uDraw.u_particles,0),e.uniform1f(this.uDraw.u_particles_res,this._pRes);let n=new Float32Array(16),r=new Float32Array(16);Cesium.Matrix4.toArray(this.viewer.camera.viewMatrix,n),Cesium.Matrix4.toArray(this.viewer.camera.frustum.projectionMatrix,r),e.uniformMatrix4fv(this.uDraw.u_viewMatrix,!1,n),e.uniformMatrix4fv(this.uDraw.u_projMatrix,!1,r),e.uniform1f(this.uDraw.u_camera_height,t),e.uniform4f(this.uDraw.u_bounds,this.bounds[0],this.bounds[1],this.bounds[2],this.bounds[3]),e.bindVertexArray(this.emptyVAO),e.drawArrays(e.POINTS,0,this._pRes*this._pRes),[this.screenA,this.screenB]=[this.screenB,this.screenA],e.bindFramebuffer(e.FRAMEBUFFER,null),e.viewport(0,0,this._sw,this._sh),e.clearColor(0,0,0,0),e.clear(e.COLOR_BUFFER_BIT),e.blendFunc(e.SRC_ALPHA,e.ONE_MINUS_SRC_ALPHA),e.useProgram(this.blitProg),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,this.screenA),e.uniform1i(this.uBlit.u_screen,0),e.bindVertexArray(this.quadVAO),e.drawArrays(e.TRIANGLE_STRIP,0,4)}},u=class{constructor(e){if(this.cols=e.cols|0,this.rows=e.rows|0,this.cellSize=Number(e.cellSize||5),this.count=this.cols*this.rows,this.canvas=document.createElement(`canvas`),this.canvas.width=this.cols,this.canvas.height=this.rows,this.gl=this.canvas.getContext(`webgl2`,{antialias:!1,depth:!1,stencil:!1,preserveDrawingBuffer:!1}),!this.gl)throw Error(`WebGL2를 사용할 수 없습니다. Chrome/Edge의 WebGL2 활성화를 확인하세요.`);let t=this.gl;if(!t.getExtension(`EXT_color_buffer_float`))throw Error(`EXT_color_buffer_float 미지원. float framebuffer 렌더링이 어렵습니다.`);t.getExtension(`OES_texture_float_linear`),this.flowFactor=Number(e.flowFactor??.6),this.manningN=Number(e.manningN??.035),this.maxOutRatio=Number(e.maxOutRatio??.55),this.edgeDrain=Number(e.edgeDrain??.02),this.minDepth=Number(e.minDepth??.002),this.time=0,this.bottomTex=this._makeTexture(this._toRGBA(e.bottomElevations,!0),t.RGBA32F,t.RGBA,t.FLOAT),this.waterTex=[this._makeTexture(null,t.RGBA32F,t.RGBA,t.FLOAT),this._makeTexture(null,t.RGBA32F,t.RGBA,t.FLOAT)],this.flowTex=this._makeTexture(null,t.RGBA32F,t.RGBA,t.FLOAT),this.fbo=t.createFramebuffer(),this.readIndex=0,this.writeIndex=1,this._clearTexture(this.waterTex[0]),this._clearTexture(this.waterTex[1]),this._clearTexture(this.flowTex),this.flowProgram=this._program(this._vs(),this._flowFs()),this.updateProgram=this._program(this._vs(),this._updateFs()),this.injectProgram=this._program(this._vs(),this._injectFs()),this.readBuffer=new Float32Array(this.count*4),this.water=new Float32Array(this.count)}_toRGBA(e,t=!1){let n=new Float32Array(this.count*4);for(let r=0;r<this.rows;r++){let i=t?this.rows-1-r:r;for(let t=0;t<this.cols;t++){let a=r*this.cols+t,o=i*this.cols+t;n[a*4]=Number(e[o]||0)}}return n}_makeTexture(e,t,n,r){let i=this.gl,a=i.createTexture();return i.bindTexture(i.TEXTURE_2D,a),i.texParameteri(i.TEXTURE_2D,i.TEXTURE_MIN_FILTER,i.NEAREST),i.texParameteri(i.TEXTURE_2D,i.TEXTURE_MAG_FILTER,i.NEAREST),i.texParameteri(i.TEXTURE_2D,i.TEXTURE_WRAP_S,i.CLAMP_TO_EDGE),i.texParameteri(i.TEXTURE_2D,i.TEXTURE_WRAP_T,i.CLAMP_TO_EDGE),i.texImage2D(i.TEXTURE_2D,0,t,this.cols,this.rows,0,n,r,e),i.bindTexture(i.TEXTURE_2D,null),a}_bindTarget(e){let t=this.gl;t.bindFramebuffer(t.FRAMEBUFFER,this.fbo),t.framebufferTexture2D(t.FRAMEBUFFER,t.COLOR_ATTACHMENT0,t.TEXTURE_2D,e,0),t.viewport(0,0,this.cols,this.rows)}_clearTexture(e){let t=this.gl;this._bindTarget(e),t.clearColor(0,0,0,0),t.clear(t.COLOR_BUFFER_BIT),t.bindFramebuffer(t.FRAMEBUFFER,null)}_vs(){return`#version 300 es
      precision highp float;
      const vec2 P[3] = vec2[3](vec2(-1.0,-1.0), vec2(3.0,-1.0), vec2(-1.0,3.0));
      void main(){ gl_Position = vec4(P[gl_VertexID], 0.0, 1.0); }
    `}_flowFs(){return`#version 300 es
      precision highp float;
      uniform sampler2D uBottom;
      uniform sampler2D uWater;
      uniform vec2 uSize;
      uniform float uFlowFactor;
      uniform float uMaxOutRatio;
      uniform float uMinDepth;
      out vec4 frag; // N,S,W,E
      float waterAt(ivec2 p){ return texelFetch(uWater, p, 0).r; }
      float bottomAt(ivec2 p){ return texelFetch(uBottom, p, 0).r; }
      void main(){
        ivec2 p = ivec2(gl_FragCoord.xy);
        int cols = int(uSize.x); int rows = int(uSize.y);
        float w = waterAt(p);
        if (w <= uMinDepth) { frag = vec4(0.0); return; }
        float surf = bottomAt(p) + w;
        float dN=0.0,dS=0.0,dW=0.0,dE=0.0;
        if (p.y < rows-1) { ivec2 q=p+ivec2(0,1); dN=max(0.0, surf-(bottomAt(q)+waterAt(q))); }
        if (p.y > 0)      { ivec2 q=p+ivec2(0,-1); dS=max(0.0, surf-(bottomAt(q)+waterAt(q))); }
        if (p.x > 0)      { ivec2 q=p+ivec2(-1,0); dW=max(0.0, surf-(bottomAt(q)+waterAt(q))); }
        if (p.x < cols-1) { ivec2 q=p+ivec2(1,0); dE=max(0.0, surf-(bottomAt(q)+waterAt(q))); }
        float sumD = dN+dS+dW+dE;
        if (sumD <= 0.0) { frag = vec4(0.0); return; }
        float outAmount = min(w * uMaxOutRatio, sumD * uFlowFactor);
        frag = vec4(dN,dS,dW,dE) / sumD * outAmount;
      }
    `}_updateFs(){return`#version 300 es
      precision highp float;
      uniform sampler2D uWater;
      uniform sampler2D uFlow;
      uniform vec2 uSize;
      uniform float uEdgeDrain;
      uniform float uMinDepth;
      out vec4 frag;
      void main(){
        ivec2 p = ivec2(gl_FragCoord.xy);
        int cols = int(uSize.x); int rows = int(uSize.y);
        vec4 f = texelFetch(uFlow, p, 0);
        float w = texelFetch(uWater, p, 0).r - (f.r+f.g+f.b+f.a);
        if (p.y > 0)      w += texelFetch(uFlow, p+ivec2(0,-1), 0).r; // south neighbor's N
        if (p.y < rows-1) w += texelFetch(uFlow, p+ivec2(0, 1), 0).g; // north neighbor's S
        if (p.x < cols-1) w += texelFetch(uFlow, p+ivec2(1,0), 0).b;  // east neighbor's W
        if (p.x > 0)      w += texelFetch(uFlow, p+ivec2(-1,0), 0).a; // west neighbor's E
        if (p.x==0 || p.y==0 || p.x==cols-1 || p.y==rows-1) w *= (1.0-uEdgeDrain);
        w = max(0.0, w);
        if (w < uMinDepth) w = 0.0;
        frag = vec4(w,0.0,0.0,1.0);
      }
    `}_injectFs(){return`#version 300 es
      precision highp float;
      uniform sampler2D uWater;
      uniform sampler2D uBottom;
      uniform vec2 uCenter;
      uniform float uAmount;
      uniform float uRadius;
      uniform float uOceanLevel;
      out vec4 fragColor;
      void main(){
        ivec2 p = ivec2(gl_FragCoord.xy);
        float w = texelFetch(uWater, p, 0).r;
        float b = texelFetch(uBottom, p, 0).r;
        float d = distance(vec2(p), uCenter);
        if (d <= uRadius && b <= uOceanLevel + 2.0) {
          float k = smoothstep(uRadius + 0.5, max(0.0, uRadius - 0.5), d);
          w = max(w, uAmount * k); // Maintain surge depth instead of adding!
        }
        fragColor = vec4(w, 0.0, 0.0, 1.0);
      }
    `}_shader(e,t){let n=this.gl,r=n.createShader(e);if(n.shaderSource(r,t),n.compileShader(r),!n.getShaderParameter(r,n.COMPILE_STATUS))throw Error(n.getShaderInfoLog(r));return r}_program(e,t){let n=this.gl,r=n.createProgram();if(n.attachShader(r,this._shader(n.VERTEX_SHADER,e)),n.attachShader(r,this._shader(n.FRAGMENT_SHADER,t)),n.linkProgram(r),!n.getProgramParameter(r,n.LINK_STATUS))throw Error(n.getProgramInfoLog(r));return r}_setCommon(e){let t=this.gl,n=t.getUniformLocation(e,`uSize`);n&&t.uniform2f(n,this.cols,this.rows)}_bindTex(e,t,n,r){let i=this.gl;i.activeTexture(i.TEXTURE0+r),i.bindTexture(i.TEXTURE_2D,n),i.uniform1i(i.getUniformLocation(e,t),r)}_draw(){this.gl.drawArrays(this.gl.TRIANGLES,0,3)}_swap(){let e=this.readIndex;this.readIndex=this.writeIndex,this.writeIndex=e}localXYToCell(e,t){let n=Math.floor(e/this.cellSize+this.cols/2);return{row:Math.floor(this.rows/2-t/this.cellSize),col:n}}addWaterLocal(e,t,n,r){let i=this.localXYToCell(e,t),a=Math.max(0,Number(r||0)/this.cellSize),o=this.gl;this._bindTarget(this.waterTex[this.writeIndex]),o.useProgram(this.injectProgram),this._bindTex(this.injectProgram,`uWater`,this.waterTex[this.readIndex],0),this._bindTex(this.injectProgram,`uBottom`,this.bottomTex,1),o.uniform2f(o.getUniformLocation(this.injectProgram,`uCenter`),i.col+.5,this.rows-i.row-.5),o.uniform1f(o.getUniformLocation(this.injectProgram,`uAmount`),Number(n||0)),o.uniform1f(o.getUniformLocation(this.injectProgram,`uRadius`),a),o.uniform1f(o.getUniformLocation(this.injectProgram,`uOceanLevel`),this.oceanLevel||0),this._draw(),this._swap()}reset(){this._clearTexture(this.waterTex[0]),this._clearTexture(this.waterTex[1]),this.time=0,this.water.fill(0)}step(){let e=this.gl;this._bindTarget(this.flowTex),e.useProgram(this.flowProgram),this._bindTex(this.flowProgram,`uBottom`,this.bottomTex,0),this._bindTex(this.flowProgram,`uWater`,this.waterTex[this.readIndex],1),this._setCommon(this.flowProgram),e.uniform1f(e.getUniformLocation(this.flowProgram,`uFlowFactor`),this.effectiveFlowFactor()),e.uniform1f(e.getUniformLocation(this.flowProgram,`uMaxOutRatio`),this.maxOutRatio),e.uniform1f(e.getUniformLocation(this.flowProgram,`uMinDepth`),this.minDepth),this._draw(),this._bindTarget(this.waterTex[this.writeIndex]),e.useProgram(this.updateProgram),this._bindTex(this.updateProgram,`uWater`,this.waterTex[this.readIndex],0),this._bindTex(this.updateProgram,`uFlow`,this.flowTex,1),this._setCommon(this.updateProgram),e.uniform1f(e.getUniformLocation(this.updateProgram,`uEdgeDrain`),this.edgeDrain),e.uniform1f(e.getUniformLocation(this.updateProgram,`uMinDepth`),this.minDepth),this._draw(),this._swap(),this.time++}effectiveFlowFactor(){let e=Math.max(.01,Number(this.manningN||.035)),t=Number(this.flowFactor||.6);return Math.max(.05,Math.min(.95,.035/e*t))}update(e){for(let t=0;t<Math.max(1,e|0);t++)this.step()}setBottom(e){let t=this.gl;t.bindTexture(t.TEXTURE_2D,this.bottomTex),t.texSubImage2D(t.TEXTURE_2D,0,0,0,this.cols,this.rows,t.RED,t.FLOAT,e)}setOceanLevel(e){this.oceanLevel=e}readWater(){let e=this.gl;this._bindTarget(this.waterTex[this.readIndex]),e.readPixels(0,0,this.cols,this.rows,e.RGBA,e.FLOAT,this.readBuffer);for(let e=0;e<this.rows;e++){let t=this.rows-1-e;for(let n=0;n<this.cols;n++)this.water[e*this.cols+n]=this.readBuffer[(t*this.cols+n)*4]}return this.water}};function d(e){let t={gpuSim:null,waterPrimitive:null,sourceEntity:null,gridEntity:null,rows:0,cols:0,cellSize:50,centerLon:-77.31,centerLat:25.02,sourceLon:-77.284956,sourceLat:25.002706,centerElevation:0,frame:Cesium.Matrix4.IDENTITY,bottom:null,maxDepth:null,running:!1,injectedVolume:0,elapsedSimSeconds:0,frameNo:0,simSize:18e3},n={prepBtn:document.getElementById(`prep-surge-btn`),playBtn:document.getElementById(`play-surge-btn`),stopBtn:document.getElementById(`stop-surge-btn`),exportBtn:document.getElementById(`export-surge-btn`),statusDisplay:document.getElementById(`surge-status-display`),camBtn:document.getElementById(`cam-c-btn`),heightSelect:document.getElementById(`surge-height-select`),speedSelect:document.getElementById(`surge-speed-select`)};function r(){return Cesium.Transforms.eastNorthUpToFixedFrame(Cesium.Cartesian3.fromDegrees(t.centerLon,t.centerLat,t.centerElevation))}function i(e){return Cesium.Matrix4.multiplyByPoint(Cesium.Matrix4.inverse(t.frame,new Cesium.Matrix4),e,new Cesium.Cartesian3)}function a(e,n,r){return Cesium.Matrix4.multiplyByPoint(t.frame,new Cesium.Cartesian3(e,n,r),new Cesium.Cartesian3)}function o(e,n,r){return i(Cesium.Cartesian3.fromDegrees(e,n,r||t.centerElevation))}async function s(){t.rows=Math.max(16,Math.floor(t.simSize/t.cellSize)),t.cols=t.rows;let n=Cesium.Transforms.eastNorthUpToFixedFrame(Cesium.Cartesian3.fromDegrees(t.centerLon,t.centerLat,0)),i=[];for(let e=0;e<t.rows;e++)for(let r=0;r<t.cols;r++){let a=(r-t.cols/2+.5)*t.cellSize,o=(t.rows/2-e-.5)*t.cellSize;i.push(Cesium.Cartographic.fromCartesian(Cesium.Matrix4.multiplyByPoint(n,new Cesium.Cartesian3(a,o,0),new Cesium.Cartesian3)))}try{await Cesium.sampleTerrainMostDetailed(e.terrainProvider,i)}catch(e){console.warn(`Terrain sampling failed, falling back to 0 elevation.`,e)}let a=Math.floor(t.rows/2)*t.cols+Math.floor(t.cols/2);t.centerElevation=Number.isFinite(i[a].height)?i[a].height:0,t.frame=r(),t.bottom=new Float32Array(t.rows*t.cols);let o=new Float32Array(i.length);for(let e=0;e<i.length;e++){let n=Number.isFinite(i[e].height)?i[e].height:t.centerElevation;t.bottom[e]=n,o[e]=n}o.sort(),t.oceanLevel=o[Math.floor(o.length*.1)]}function c(e){return Math.max(.18,Math.min(.62,.035/Math.max(.01,e)*.58))}async function l(){t.running=!1,n.statusDisplay.textContent=`Status: Sampling terrain...`,n.prepBtn.disabled=!0,await s(),t.injectedVolume=0,t.elapsedSimSeconds=0,t.maxDepth=new Float32Array(t.rows*t.cols);let e=.035;t.gpuSim=new u({rows:t.rows,cols:t.cols,cellSize:t.cellSize,bottomElevations:t.bottom,flowFactor:.62,manningN:e,maxOutRatio:c(e),edgeDrain:.005,minDepth:.002}),t.gpuSim.setOceanLevel(t.oceanLevel),p(),n.statusDisplay.textContent=`Status: Ready | Grid: ${t.cols}x${t.rows}`,n.prepBtn.disabled=!1,n.playBtn.disabled=!1,n.stopBtn.disabled=!0,n.exportBtn.style.display=`block`}function d(){let e=o(t.sourceLon,t.sourceLat,t.centerElevation),r=(parseFloat(n.heightSelect.value)||4.6)+1.8,i=1e3+t.elapsedSimSeconds*80;i>25e3&&(i=25e3),t.gpuSim.addWaterLocal(e.x,e.y,r,i),t.injectedVolume+=r*(Math.PI*i*i),t.elapsedSimSeconds+=1}function f(e){if(!(!t.maxDepth||!e))for(let n=0;n<e.length;n++)e[n]>t.maxDepth[n]&&(t.maxDepth[n]=e[n])}function p(){if(t.waterPrimitive&&e.scene.primitives.remove(t.waterPrimitive),!t.gpuSim||!t.bottom)return;let n=t.gpuSim.readWater(),r=[],i=[],o=0;for(let e=0;e<t.rows;e++)for(let s=0;s<t.cols;s++){let c=e*t.cols+s,l=n[c];if(l<=.01)continue;let u=(s-t.cols/2+.5)*t.cellSize,d=(t.rows/2-e-.5)*t.cellSize,f=t.bottom[c]-t.centerElevation+Math.min(l,50)+.05,p=t.cellSize*.49;for(let e of[[u-p,d-p,f],[u+p,d-p,f],[u+p,d+p,f],[u-p,d+p,f]]){let t=a(e[0],e[1],e[2]);r.push(t.x,t.y,t.z)}i.push(o,o+1,o+2,o,o+2,o+3),o+=4}if(!o)return;let s=new Cesium.Geometry({attributes:{position:new Cesium.GeometryAttribute({componentDatatype:Cesium.ComponentDatatype.DOUBLE,componentsPerAttribute:3,values:new Float64Array(r)})},indices:new Uint32Array(i),primitiveType:Cesium.PrimitiveType.TRIANGLES,boundingSphere:Cesium.BoundingSphere.fromVertices(r)});t.waterPrimitive=e.scene.primitives.add(new Cesium.Primitive({geometryInstances:new Cesium.GeometryInstance({geometry:s}),appearance:new Cesium.MaterialAppearance({material:Cesium.Material.fromType(`Color`,{color:Cesium.Color.fromCssColorString(`#00aeea`).withAlpha(.68)}),translucent:!0,closed:!1}),asynchronous:!1}))}function m(){if(t.gpuSim){if(t.running){d();let e=parseInt(n.speedSelect.value)||6;t.gpuSim.update(e),f(t.gpuSim.readWater())}t.frameNo++%3==0&&t.running&&p(),t.frameNo%30==0&&t.running&&h()}}function h(){let e=t.gpuSim.readWater(),r=0,i=0;for(let t of e)t>.002&&i++,t>r&&(r=t);n.statusDisplay.textContent=`Tick: ${t.gpuSim.time} | Max Depth: ${r.toFixed(1)}m | Wet Cells: ${i}`}function g(e,t){let n=a(e,t,0),r=Cesium.Cartographic.fromCartesian(n);return[Cesium.Math.toDegrees(r.longitude),Cesium.Math.toDegrees(r.latitude)]}function _(e){if(!t.maxDepth||!t.rows||!t.cols)throw Error(`No simulation data.`);let n=t.rows,r=t.cols,i=t.cellSize,a=new Uint8Array(n*r),o=0,s=0;for(let n=0;n<t.maxDepth.length;n++){let r=t.maxDepth[n];r>=e&&(a[n]=1,o++),r>s&&(s=r)}if(!o)throw Error(`No cells reached the threshold depth.`);let c=(e,t)=>e>=0&&e<n&&t>=0&&t<r&&a[e*r+t]===1,l=(e,t)=>`${e},${t}`,u=e=>e.split(`,`).map(Number),d=new Map,f=(e,t)=>{d.has(e)||d.set(e,[]),d.get(e).push(t)};for(let e=0;e<n;e++)for(let t=0;t<r;t++)c(e,t)&&(c(e-1,t)||f(l(t+1,e),l(t,e)),c(e,t+1)||f(l(t+1,e+1),l(t+1,e)),c(e+1,t)||f(l(t,e+1),l(t+1,e+1)),c(e,t-1)||f(l(t,e),l(t,e+1)));let p=[];for(;d.size;){let e=d.keys().next().value,t=e,a=[t],o=0;for(;o++<n*r*8;){let n=d.get(t);if(!n||n.length===0){d.delete(t);break}let r=n.pop();if(n.length===0&&d.delete(t),t=r,a.push(t),t===e)break}if(a.length>=4&&a[0]===a[a.length-1]){let e=a.map(e=>{let[t,a]=u(e);return g((t-r/2)*i,(n/2-a)*i)});p.push(e)}}let m=p.map(e=>[e]);return{type:`FeatureCollection`,name:`maximum_inundation_extent`,crs:{type:`name`,properties:{name:`urn:ogc:def:crs:OGC:1.3:CRS84`}},features:[{type:`Feature`,properties:{kind:`maximum_inundation_extent`,max_depth_m:Number(s.toFixed(3)),wet_cells:o},geometry:{type:`MultiPolygon`,coordinates:m}}]}}function v(){try{let e=_(.1),t=new Blob([JSON.stringify(e,null,2)],{type:`application/geo+json;charset=utf-8`}),n=URL.createObjectURL(t),r=document.createElement(`a`);r.href=n,r.download=`storm_surge_max_extent.geojson`,document.body.appendChild(r),r.click(),r.remove(),URL.revokeObjectURL(n)}catch(e){alert(e.message||String(e))}}return n.prepBtn.addEventListener(`click`,l),n.playBtn.addEventListener(`click`,()=>{t.running=!0,n.playBtn.disabled=!0,n.stopBtn.disabled=!1}),n.stopBtn.addEventListener(`click`,()=>{t.running=!1,n.playBtn.disabled=!1,n.stopBtn.disabled=!0}),n.exportBtn.addEventListener(`click`,v),n.camBtn.addEventListener(`click`,()=>{e.camera.flyTo({destination:Cesium.Cartesian3.fromDegrees(-77.25,24.97,4e3),orientation:{heading:Cesium.Math.toRadians(330),pitch:Cesium.Math.toRadians(-30),roll:0}})}),e.scene.preUpdate.addEventListener(m),{stop:()=>{t.running=!1,n.playBtn.disabled=!1,n.stopBtn.disabled=!0},toggleVisibility:e=>{t.waterPrimitive&&(t.waterPrimitive.show=e),t.gridEntity&&(t.gridEntity.show=e),t.sourceEntity&&(t.sourceEntity.show=e)}}}Cesium.Ion.defaultAccessToken=`eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIzYTM3ODhlNC1jOWUxLTRhOTYtYTgwZC1iMDA3OGJiMTQwZDciLCJpZCI6MTI5NDU5LCJpYXQiOjE2ODIwNTc4NjN9.GC-W9QfAFa9rXMh2Ow2rSC5UvLcwtS_qjWJ1v454z1A`;var f=new Cesium.Viewer(`cesiumContainer`,{terrainProvider:await Cesium.createWorldTerrainAsync(),baseLayerPicker:!1,sceneModePicker:!1,navigationHelpButton:!1,animation:!1,timeline:!1,geocoder:!1,homeButton:!1,infoBox:!1,requestRenderMode:!1}),p=new Cesium.BoundingSphere(Cesium.Cartesian3.fromDegrees(-77.8,24.2,0),0);f.camera.flyToBoundingSphere(p,{offset:new Cesium.HeadingPitchRange(Cesium.Math.toRadians(0),Cesium.Math.toRadians(-35),12e5)});var m=null;try{m=await Cesium.createOsmBuildingsAsync(),f.scene.primitives.add(m)}catch(e){console.error(`Failed to load buildings:`,e)}var h=null;try{h=await Cesium.createGooglePhotorealistic3DTileset(),f.scene.primitives.add(h)}catch(e){console.error(`Google 3D Tiles Error`,e)}h&&(h.show=!0),m&&(m.show=!1),f.scene.globe.show=!1;var g=0,_=0,v=.4,y=f.entities.add({name:`Flood Water`,show:!1,polygon:{hierarchy:Cesium.Cartesian3.fromDegreesArray([-77.6,24.9,-77.2,24.9,-77.2,25.1,-77.6,25.1]),height:-50,extrudedHeight:new Cesium.CallbackProperty(()=>{let e=parseFloat(document.getElementById(`slr-multi`).value)||1;return g+_/e},!1),material:new Cesium.ColorMaterialProperty(new Cesium.CallbackProperty(()=>new Cesium.Color(0,.588,.784,v),!1))}}),b=null,x=.85;document.getElementById(`base-layer-select`).addEventListener(`change`,async e=>{let t=e.target.value;if(f.imageryLayers.removeAll(),t===`google-3d`){if(h)h.show=!0;else try{h=await Cesium.createGooglePhotorealistic3DTileset(),f.scene.primitives.add(h)}catch{}m&&(m.show=!1),f.scene.globe.show=!1}else if(h&&(h.show=!1),m&&(m.show=!0),f.scene.globe.show=!0,t===`google-sat`)f.imageryLayers.addImageryProvider(await Cesium.ArcGisMapServerImageryProvider.fromUrl(`https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer`));else if(t===`google-hybrid`)f.imageryLayers.addImageryProvider(new Cesium.UrlTemplateImageryProvider({url:`https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}`}));else if(t===`google-road`)f.imageryLayers.addImageryProvider(new Cesium.OpenStreetMapImageryProvider({url:`https://a.tile.openstreetmap.org/`}));else if(t===`bing-aerial`)try{f.imageryLayers.addImageryProvider(await Cesium.IonImageryProvider.fromAssetId(2))}catch{console.warn(`Bing Maps requires valid token.`)}}),document.getElementById(`dem-toggle`).addEventListener(`change`,async e=>{let t=e.target.checked,n=document.getElementById(`dem-opacity-container`);n&&(n.style.display=t?`block`:`none`),t?(b||=f.entities.add({rectangle:{coordinates:Cesium.Rectangle.fromDegrees(-77.562132646,24.902444318,-77.142132646,25.166435349),material:new Cesium.ImageMaterialProperty({image:`./data/dem_overlay.png`,transparent:!0,color:new Cesium.CallbackProperty(()=>new Cesium.Color(1,1,1,x),!1)}),classificationType:Cesium.ClassificationType.BOTH}}),b.show=!0):b&&(b.show=!1)}),document.getElementById(`dem-opacity-slider`).addEventListener(`input`,e=>{let t=parseFloat(e.target.value);document.getElementById(`dem-opacity-display`).textContent=`Drape Opacity: ${Math.round(t*100)}%`,x=t});var S=document.getElementById(`slr-slider`),C=document.getElementById(`slr-value-display`),w=document.getElementById(`slr-multi`);document.getElementById(`opacity-slider`),document.getElementById(`water-opacity-display`);function T(){let e=parseFloat(S.value),t=parseFloat(w.value);_=e,C.textContent=`Rise: ${_.toFixed(1)}m`,y.show=_>0,f.scene.verticalExaggeration!==void 0&&(f.scene.verticalExaggeration=t,f.scene.verticalExaggerationRelativeHeight=g)}S.addEventListener(`input`,T),document.getElementById(`slr-multi`).addEventListener(`change`,T),document.getElementById(`opacity-slider`).addEventListener(`input`,e=>{let t=parseFloat(e.target.value);document.getElementById(`water-opacity-display`).textContent=`Water Transparency: ${Math.round(t*100)}%`,v=1-t}),document.getElementById(`export-slr-btn`).addEventListener(`click`,()=>{let e={type:`FeatureCollection`,features:[{type:`Feature`,geometry:{type:`Polygon`,coordinates:[[[-77.6,24.9],[-77.2,24.9],[-77.2,25.1],[-77.6,25.1],[-77.6,24.9]]]},properties:{scenario:`Sea Level Rise`,riseMeters:_,verticalExaggeration:parseFloat(document.getElementById(`slr-multi`).value)}}]},t=new Blob([JSON.stringify(e,null,2)],{type:`application/json`}),n=URL.createObjectURL(t),r=document.createElement(`a`);r.href=n,r.download=`nassau_flood_${_}m.geojson`,r.click()});var E=Cesium.Cartesian3.fromDegrees(-77.31741897697012,25.08557864866101,0);new Cesium.BoundingSphere(E,0);function D(){f.camera.flyTo({destination:Cesium.Cartesian3.fromDegrees(-77.325,25.105,600),orientation:{heading:Cesium.Math.toRadians(165),pitch:Cesium.Math.toRadians(-13),roll:0}})}var O=new Cesium.BoundingSphere(Cesium.Cartesian3.fromDegrees(-77.3194069,25.0918849,0),0);function k(){f.camera.flyToBoundingSphere(O,{offset:new Cesium.HeadingPitchRange(Cesium.Math.toRadians(90),Cesium.Math.toRadians(-15),2300)})}document.getElementById(`cam-b-btn`).addEventListener(`click`,D),document.getElementById(`cam-a-btn`).addEventListener(`click`,k);var A=document.getElementById(`wind-canvas`),j=null;try{j=new l(A,f),j.loadWindData(`./data/uv_before.bin`,`./data/uv_meta.json`).catch(e=>console.error(e))}catch(e){console.error(`WebGL2 Failed`,e)}var M=!1,N=!1,P=document.getElementById(`play-sim-btn`),F=document.getElementById(`mangrove-toggle`);async function I(){if(!j)return;let e=Date.now();N?await j.loadWindData(`./data/uv_after.bin?t=`+e,`./data/uv_meta.json?t=`+e):await j.loadWindData(`./data/uv_before.bin?t=`+e,`./data/uv_meta.json?t=`+e)}F.addEventListener(`change`,async e=>{N=e.target.checked,await I()}),P.addEventListener(`click`,()=>{M=!M,M?(P.textContent=`Stop Simulation`,j&&j.start()):(P.textContent=`Play Simulation`,j&&j.stop())});var L=null;Cesium.GeoJsonDataSource.load(`./data/mangrove_area.geojson`,{stroke:Cesium.Color.GREEN,fill:new Cesium.Color(.13,.54,.13,.6),strokeWidth:3}).then(e=>{L=e,f.dataSources.add(e);for(let t=0;t<e.entities.values.length;t++){let n=e.entities.values[t];n.polygon&&(n.polygon.extrudedHeight=8,n.polygon.height=1)}L.show=!1});var R=null;setTimeout(()=>{R=d(f)},1e3);var z=null,B=null,V=[];V.push(f.entities.add({position:Cesium.Cartesian3.fromDegrees(-78.2,26.6,500),label:{text:`Grand Bahama
(Severe Damage)`,font:`bold 13pt sans-serif`,fillColor:Cesium.Color.WHITE,style:Cesium.LabelStyle.FILL_AND_OUTLINE,outlineWidth:3,outlineColor:Cesium.Color.BLACK,verticalOrigin:Cesium.VerticalOrigin.BOTTOM,pixelOffset:new Cesium.Cartesian2(0,-10)},show:!1})),V.push(f.entities.add({position:Cesium.Cartesian3.fromDegrees(-77.4,26.4,500),label:{text:`Abaco Islands
(Eye Landfall)`,font:`bold 13pt sans-serif`,fillColor:Cesium.Color.WHITE,style:Cesium.LabelStyle.FILL_AND_OUTLINE,outlineWidth:3,outlineColor:Cesium.Color.BLACK,verticalOrigin:Cesium.VerticalOrigin.BOTTOM,pixelOffset:new Cesium.Cartesian2(0,-10)},show:!1})),Cesium.GeoJsonDataSource.load(`./data/hurricane_dorian.geojson`,{stroke:Cesium.Color.RED,strokeWidth:4,markerColor:Cesium.Color.RED,markerSymbol:`hurricane`}).then(e=>{z=e,f.dataSources.add(e),z.show=!1}),Cesium.GeoJsonDataSource.load(`./data/major_hurricanes.geojson`,{stroke:Cesium.Color.ORANGE.withAlpha(.6),strokeWidth:2,markerColor:Cesium.Color.ORANGE,markerSize:20}).then(e=>{B=e,f.dataSources.add(e),B.show=!1});var H=document.getElementById(`dorian-toggle`),U=document.getElementById(`major-toggle`);H.addEventListener(`change`,e=>{z&&(z.show=e.target.checked),V.forEach(t=>t.show=e.target.checked)}),U.addEventListener(`change`,e=>{B&&(B.show=e.target.checked)}),document.getElementById(`cam-d-btn`).addEventListener(`click`,()=>{f.camera.flyTo({destination:Cesium.Cartesian3.fromDegrees(-75,24,15e5),orientation:{heading:0,pitch:Cesium.Math.toRadians(-90),roll:0}})}),document.getElementById(`tab-b`).addEventListener(`click`,()=>{document.getElementById(`tab-b`).classList.add(`active`),document.getElementById(`tab-a`).classList.remove(`active`),document.getElementById(`tab-c`).classList.remove(`active`),document.getElementById(`tab-d`).classList.remove(`active`),document.getElementById(`content-b`).classList.add(`active`),document.getElementById(`content-a`).classList.remove(`active`),document.getElementById(`content-c`).classList.remove(`active`),document.getElementById(`content-d`).classList.remove(`active`),M&&(M=!1,P.textContent=`Play Simulation`),j&&j.stop(),L&&(L.show=!1),R&&R.toggleVisibility(!1),z&&(z.show=!1),B&&(B.show=!1),V.forEach(e=>e.show=!1),T()}),document.getElementById(`tab-a`).addEventListener(`click`,()=>{document.getElementById(`tab-a`).classList.add(`active`),document.getElementById(`tab-b`).classList.remove(`active`),document.getElementById(`tab-c`).classList.remove(`active`),document.getElementById(`tab-d`).classList.remove(`active`),document.getElementById(`content-a`).classList.add(`active`),document.getElementById(`content-b`).classList.remove(`active`),document.getElementById(`content-c`).classList.remove(`active`),document.getElementById(`content-d`).classList.remove(`active`),y.show=!1,R&&R.toggleVisibility(!1),z&&(z.show=!1),B&&(B.show=!1),V.forEach(e=>e.show=!1),L&&(L.show=N)}),document.getElementById(`tab-c`).addEventListener(`click`,()=>{document.getElementById(`tab-c`).classList.add(`active`),document.getElementById(`tab-a`).classList.remove(`active`),document.getElementById(`tab-b`).classList.remove(`active`),document.getElementById(`tab-d`).classList.remove(`active`),document.getElementById(`content-c`).classList.add(`active`),document.getElementById(`content-a`).classList.remove(`active`),document.getElementById(`content-b`).classList.remove(`active`),document.getElementById(`content-d`).classList.remove(`active`),M&&(M=!1,P.textContent=`Play Simulation`),j&&j.stop(),L&&(L.show=!1),y.show=!1,z&&(z.show=!1),B&&(B.show=!1),V.forEach(e=>e.show=!1),R&&R.toggleVisibility(!0)}),document.getElementById(`tab-d`).addEventListener(`click`,()=>{document.getElementById(`tab-d`).classList.add(`active`),document.getElementById(`tab-a`).classList.remove(`active`),document.getElementById(`tab-b`).classList.remove(`active`),document.getElementById(`tab-c`).classList.remove(`active`),document.getElementById(`content-d`).classList.add(`active`),document.getElementById(`content-a`).classList.remove(`active`),document.getElementById(`content-b`).classList.remove(`active`),document.getElementById(`content-c`).classList.remove(`active`),M&&(M=!1,P.textContent=`Play Simulation`),j&&j.stop(),L&&(L.show=!1),y.show=!1,R&&R.toggleVisibility(!1),z&&(z.show=H.checked),B&&(B.show=U.checked),V.forEach(e=>e.show=H.checked)}),F.addEventListener(`change`,e=>{document.getElementById(`tab-a`).classList.contains(`active`)&&L&&(L.show=e.target.checked)});