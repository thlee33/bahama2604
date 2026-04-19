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
`,n),null)}function s(e,t,n){let r=e.createProgram();return e.attachShader(r,o(e,e.VERTEX_SHADER,t)),e.attachShader(r,o(e,e.FRAGMENT_SHADER,n)),e.linkProgram(r),e.getProgramParameter(r,e.LINK_STATUS)?r:(console.error(`Link error:`,e.getProgramInfoLog(r)),null)}function c(e,t,n){let r={};for(let i of n)r[i]=e.getUniformLocation(t,i);return r}var l=class{constructor(e,t){if(this.canvas=e,this.viewer=t,this.gl=e.getContext(`webgl2`,{alpha:!0,premultipliedAlpha:!1,antialias:!1}),!this.gl)throw Error(`WebGL2 not supported`);this.numParticles=16384,this.speedFactor=.5,this.dropRate=.003,this.dropRateBump=.01,this.fadeOpacity=.99,this.bounds=[0,0,0,0],this.active=!1,this.initGL(),this._rAF=null,this.viewer.scene.preRender.addEventListener(this.syncCanvas.bind(this))}initGL(){let o=this.gl;o.getExtension(`EXT_color_buffer_float`),o.getExtension(`OES_texture_float_linear`),this.updateProg=s(o,e,t),this.drawProg=s(o,n,r),this.fadeProg=s(o,e,i),this.blitProg=s(o,e,a),this.uUpdate={u_particles:null,u_wind:null,u_rand_seed:null,u_speed_factor:null,u_camera_height:null,u_drop_rate:null,u_drop_rate_bump:null,u_bounds:null},this.uDraw={u_particles:null,u_particles_res:null,u_viewMatrix:null,u_projMatrix:null,u_camera_height:null,u_bounds:null},this.uFade=c(o,this.fadeProg,[`u_screen`,`u_opacity`]),this.uBlit=c(o,this.blitProg,[`u_screen`]);for(let e in this.uUpdate)this.uUpdate[e]=o.getUniformLocation(this.updateProg,e);for(let e in this.uFade)this.uFade[e]=o.getUniformLocation(this.fadeProg,e);for(let e in this.uDraw)this.uDraw[e]=o.getUniformLocation(this.drawProg,e);for(let e in this.uBlit)this.uBlit[e]=o.getUniformLocation(this.blitProg,e);this.quadVAO=o.createVertexArray(),o.bindVertexArray(this.quadVAO);let l=o.createBuffer();o.bindBuffer(o.ARRAY_BUFFER,l),o.bufferData(o.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),o.STATIC_DRAW),o.enableVertexAttribArray(0),o.vertexAttribPointer(0,2,o.FLOAT,!1,0,0),o.bindVertexArray(null),this.emptyVAO=o.createVertexArray(),this._initParticles(),this._sw=this.canvas.width,this._sh=this.canvas.height,this.screenA=this._mkScreenTex(),this.screenB=this._mkScreenTex(),this.fbo=o.createFramebuffer()}_initParticles(){let e=this.gl,t=Math.ceil(Math.sqrt(this.numParticles));this._pRes=t;let n=t*t,r=new Float32Array(n*4);for(let e=0;e<n;e++)r[e*4]=Math.random(),r[e*4+1]=Math.random(),r[e*4+2]=0,r[e*4+3]=1;let i=()=>{let n=e.createTexture();return e.bindTexture(e.TEXTURE_2D,n),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.NEAREST),e.texImage2D(e.TEXTURE_2D,0,e.RGBA32F,t,t,0,e.RGBA,e.FLOAT,r),n};this.pA&&e.deleteTexture(this.pA),this.pB&&e.deleteTexture(this.pB),this.pA=i(),this.pB=i()}_mkScreenTex(){let e=this.gl,t=e.createTexture();return e.bindTexture(e.TEXTURE_2D,t),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),e.texImage2D(e.TEXTURE_2D,0,e.RGBA8,this._sw,this._sh,0,e.RGBA,e.UNSIGNED_BYTE,null),t}async loadWindData(e,t){let[n,r]=await Promise.all([fetch(e),fetch(t)]),i=await n.arrayBuffer(),a=await r.json(),o=new Uint16Array(i);this.bounds=[a.bounds[0][0],a.bounds[0][1],a.bounds[1][0],a.bounds[1][1]];let s=this.gl;this.windTex&&s.deleteTexture(this.windTex),this.windTex=s.createTexture(),s.bindTexture(s.TEXTURE_2D,this.windTex),s.texParameteri(s.TEXTURE_2D,s.TEXTURE_WRAP_S,s.CLAMP_TO_EDGE),s.texParameteri(s.TEXTURE_2D,s.TEXTURE_WRAP_T,s.CLAMP_TO_EDGE),s.texParameteri(s.TEXTURE_2D,s.TEXTURE_MIN_FILTER,s.LINEAR),s.texParameteri(s.TEXTURE_2D,s.TEXTURE_MAG_FILTER,s.LINEAR),s.texImage2D(s.TEXTURE_2D,0,s.RG16F,a.width,a.height,0,s.RG,s.HALF_FLOAT,o)}syncCanvas(){if(!this.active)return;let e=this.viewer.canvas.clientWidth,t=this.viewer.canvas.clientHeight;(this.canvas.width!==e||this.canvas.height!==t)&&(this.canvas.width=e,this.canvas.height=t,this._sw=e,this._sh=t,this.gl.deleteTexture(this.screenA),this.gl.deleteTexture(this.screenB),this.screenA=this._mkScreenTex(),this.screenB=this._mkScreenTex())}start(){this.active||(this.active=!0,this.canvas.style.display=`block`,this.lastTime=performance.now(),this.renderLoop())}stop(){this.active=!1,this.canvas.style.display=`none`,this._rAF&&cancelAnimationFrame(this._rAF)}clear(){let e=this.gl;e.bindFramebuffer(e.FRAMEBUFFER,this.fbo),e.framebufferTexture2D(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,this.screenA,0),e.clearColor(0,0,0,0),e.clear(e.COLOR_BUFFER_BIT),e.framebufferTexture2D(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,this.screenB,0),e.clear(e.COLOR_BUFFER_BIT),e.bindFramebuffer(e.FRAMEBUFFER,null)}renderLoop(){this.active&&(this.windTex&&this.renderFrame(),this._rAF=requestAnimationFrame(this.renderLoop.bind(this)))}renderFrame(){let e=this.gl;e.bindFramebuffer(e.FRAMEBUFFER,this.fbo),e.framebufferTexture2D(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,this.pB,0),e.viewport(0,0,this._pRes,this._pRes),e.disable(e.BLEND),e.useProgram(this.updateProg),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,this.pA),e.uniform1i(this.uUpdate.u_particles,0),e.activeTexture(e.TEXTURE1),e.bindTexture(e.TEXTURE_2D,this.windTex),e.uniform1i(this.uUpdate.u_wind,1),e.uniform1f(this.uUpdate.u_rand_seed,Math.random()),e.uniform1f(this.uUpdate.u_speed_factor,this.speedFactor),e.uniform1f(this.uUpdate.u_drop_rate,this.dropRate),e.uniform1f(this.uUpdate.u_drop_rate_bump,this.dropRateBump);let t=this.viewer.camera.positionCartographic.height;e.uniform1f(this.uUpdate.u_camera_height,t),e.uniform4f(this.uUpdate.u_bounds,this.bounds[0],this.bounds[1],this.bounds[2],this.bounds[3]),e.bindVertexArray(this.quadVAO),e.drawArrays(e.TRIANGLE_STRIP,0,4),[this.pA,this.pB]=[this.pB,this.pA],e.framebufferTexture2D(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,this.screenB,0),e.viewport(0,0,this._sw,this._sh),e.useProgram(this.fadeProg),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,this.screenA),e.uniform1i(this.uFade.u_screen,0),e.uniform1f(this.uFade.u_opacity,this.fadeOpacity),e.drawArrays(e.TRIANGLE_STRIP,0,4),e.enable(e.BLEND),e.blendFunc(e.SRC_ALPHA,e.ONE_MINUS_SRC_ALPHA),e.blendEquation(e.FUNC_ADD),e.useProgram(this.drawProg),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,this.pA),e.uniform1i(this.uDraw.u_particles,0),e.uniform1f(this.uDraw.u_particles_res,this._pRes);let n=new Float32Array(16),r=new Float32Array(16);Cesium.Matrix4.toArray(this.viewer.camera.viewMatrix,n),Cesium.Matrix4.toArray(this.viewer.camera.frustum.projectionMatrix,r),e.uniformMatrix4fv(this.uDraw.u_viewMatrix,!1,n),e.uniformMatrix4fv(this.uDraw.u_projMatrix,!1,r),e.uniform1f(this.uDraw.u_camera_height,t),e.uniform4f(this.uDraw.u_bounds,this.bounds[0],this.bounds[1],this.bounds[2],this.bounds[3]),e.bindVertexArray(this.emptyVAO),e.drawArrays(e.POINTS,0,this._pRes*this._pRes),[this.screenA,this.screenB]=[this.screenB,this.screenA],e.bindFramebuffer(e.FRAMEBUFFER,null),e.viewport(0,0,this._sw,this._sh),e.clearColor(0,0,0,0),e.clear(e.COLOR_BUFFER_BIT),e.blendFunc(e.SRC_ALPHA,e.ONE_MINUS_SRC_ALPHA),e.useProgram(this.blitProg),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,this.screenA),e.uniform1i(this.uBlit.u_screen,0),e.bindVertexArray(this.quadVAO),e.drawArrays(e.TRIANGLE_STRIP,0,4)}};Cesium.Ion.defaultAccessToken=`eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIzYTM3ODhlNC1jOWUxLTRhOTYtYTgwZC1iMDA3OGJiMTQwZDciLCJpZCI6MTI5NDU5LCJpYXQiOjE2ODIwNTc4NjN9.GC-W9QfAFa9rXMh2Ow2rSC5UvLcwtS_qjWJ1v454z1A`;var u=new Cesium.Viewer(`cesiumContainer`,{terrainProvider:await Cesium.createWorldTerrainAsync(),baseLayerPicker:!1,sceneModePicker:!1,navigationHelpButton:!1,animation:!1,timeline:!1,geocoder:!1,homeButton:!1,infoBox:!1,requestRenderMode:!1}),d=new Cesium.BoundingSphere(Cesium.Cartesian3.fromDegrees(-77.8,24.2,0),0);u.camera.flyToBoundingSphere(d,{offset:new Cesium.HeadingPitchRange(Cesium.Math.toRadians(0),Cesium.Math.toRadians(-35),12e5)});var f=null;try{f=await Cesium.createOsmBuildingsAsync(),u.scene.primitives.add(f)}catch(e){console.error(`Failed to load buildings:`,e)}var p=null;try{p=await Cesium.createGooglePhotorealistic3DTileset(),u.scene.primitives.add(p)}catch(e){console.error(`Google 3D Tiles Error`,e)}p&&(p.show=!0),f&&(f.show=!1),u.scene.globe.show=!1;var m=0,h=0,g=.4,_=u.entities.add({name:`Flood Water`,show:!1,polygon:{hierarchy:Cesium.Cartesian3.fromDegreesArray([-77.6,24.9,-77.2,24.9,-77.2,25.1,-77.6,25.1]),height:-50,extrudedHeight:new Cesium.CallbackProperty(()=>{let e=parseFloat(document.getElementById(`slr-multi`).value)||1;return m+h/e},!1),material:new Cesium.ColorMaterialProperty(new Cesium.CallbackProperty(()=>new Cesium.Color(0,.588,.784,g),!1))}}),v=null,y=.85;document.getElementById(`base-layer-select`).addEventListener(`change`,async e=>{let t=e.target.value;if(u.imageryLayers.removeAll(),t===`google-3d`){if(p)p.show=!0;else try{p=await Cesium.createGooglePhotorealistic3DTileset(),u.scene.primitives.add(p)}catch{}f&&(f.show=!1),u.scene.globe.show=!1}else if(p&&(p.show=!1),f&&(f.show=!0),u.scene.globe.show=!0,t===`google-sat`)u.imageryLayers.addImageryProvider(await Cesium.ArcGisMapServerImageryProvider.fromUrl(`https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer`));else if(t===`google-hybrid`)u.imageryLayers.addImageryProvider(new Cesium.UrlTemplateImageryProvider({url:`https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}`}));else if(t===`google-road`)u.imageryLayers.addImageryProvider(new Cesium.OpenStreetMapImageryProvider({url:`https://a.tile.openstreetmap.org/`}));else if(t===`bing-aerial`)try{u.imageryLayers.addImageryProvider(await Cesium.IonImageryProvider.fromAssetId(2))}catch{console.warn(`Bing Maps requires valid token.`)}}),document.getElementById(`dem-toggle`).addEventListener(`change`,async e=>{let t=e.target.checked,n=document.getElementById(`dem-opacity-container`);n&&(n.style.display=t?`block`:`none`),t?(v||=u.entities.add({rectangle:{coordinates:Cesium.Rectangle.fromDegrees(-77.562132646,24.902444318,-77.142132646,25.166435349),material:new Cesium.ImageMaterialProperty({image:`/data/dem_overlay.png`,transparent:!0,color:new Cesium.CallbackProperty(()=>new Cesium.Color(1,1,1,y),!1)}),classificationType:Cesium.ClassificationType.BOTH}}),v.show=!0):v&&(v.show=!1)}),document.getElementById(`dem-opacity-slider`).addEventListener(`input`,e=>{let t=parseFloat(e.target.value);document.getElementById(`dem-opacity-display`).textContent=`Drape Opacity: ${Math.round(t*100)}%`,y=t});var b=document.getElementById(`slr-slider`),x=document.getElementById(`slr-value-display`),S=document.getElementById(`slr-multi`);document.getElementById(`opacity-slider`),document.getElementById(`water-opacity-display`);function C(){let e=parseFloat(b.value),t=parseFloat(S.value);h=e,x.textContent=`Rise: ${h.toFixed(1)}m`,_.show=h>0,u.scene.verticalExaggeration!==void 0&&(u.scene.verticalExaggeration=t,u.scene.verticalExaggerationRelativeHeight=m)}b.addEventListener(`input`,C),document.getElementById(`slr-multi`).addEventListener(`change`,C),document.getElementById(`opacity-slider`).addEventListener(`input`,e=>{let t=parseFloat(e.target.value);document.getElementById(`water-opacity-display`).textContent=`Water Transparency: ${Math.round(t*100)}%`,g=1-t}),document.getElementById(`export-slr-btn`).addEventListener(`click`,()=>{let e={type:`FeatureCollection`,features:[{type:`Feature`,geometry:{type:`Polygon`,coordinates:[[[-77.6,24.9],[-77.2,24.9],[-77.2,25.1],[-77.6,25.1],[-77.6,24.9]]]},properties:{scenario:`Sea Level Rise`,riseMeters:h,verticalExaggeration:parseFloat(document.getElementById(`slr-multi`).value)}}]},t=new Blob([JSON.stringify(e,null,2)],{type:`application/json`}),n=URL.createObjectURL(t),r=document.createElement(`a`);r.href=n,r.download=`nassau_flood_${h}m.geojson`,r.click()});var w=Cesium.Cartesian3.fromDegrees(-77.31741897697012,25.08557864866101,0);new Cesium.BoundingSphere(w,0);function T(){u.camera.flyTo({destination:Cesium.Cartesian3.fromDegrees(-77.325,25.105,600),orientation:{heading:Cesium.Math.toRadians(165),pitch:Cesium.Math.toRadians(-13),roll:0}})}var E=new Cesium.BoundingSphere(Cesium.Cartesian3.fromDegrees(-77.3194069,25.0918849,0),0);function D(){u.camera.flyToBoundingSphere(E,{offset:new Cesium.HeadingPitchRange(Cesium.Math.toRadians(90),Cesium.Math.toRadians(-15),2300)})}document.getElementById(`cam-b-btn`).addEventListener(`click`,T),document.getElementById(`cam-a-btn`).addEventListener(`click`,D);var O=document.getElementById(`wind-canvas`),k=null;try{k=new l(O,u),k.loadWindData(`/data/uv_before.bin`,`/data/uv_meta.json`).catch(e=>console.error(e))}catch(e){console.error(`WebGL2 Failed`,e)}var A=!1,j=!1,M=document.getElementById(`play-sim-btn`),N=document.getElementById(`mangrove-toggle`);async function P(){if(!k)return;let e=Date.now();j?await k.loadWindData(`/data/uv_after.bin?t=`+e,`/data/uv_meta.json?t=`+e):await k.loadWindData(`/data/uv_before.bin?t=`+e,`/data/uv_meta.json?t=`+e)}N.addEventListener(`change`,async e=>{j=e.target.checked,await P()}),M.addEventListener(`click`,()=>{A=!A,A?(M.textContent=`Stop Simulation`,k&&k.start()):(M.textContent=`Play Simulation`,k&&k.stop())});var F=null;Cesium.GeoJsonDataSource.load(`/data/mangrove_area.geojson`,{stroke:Cesium.Color.GREEN,fill:new Cesium.Color(.13,.54,.13,.6),strokeWidth:3}).then(e=>{F=e,u.dataSources.add(e);for(let t=0;t<e.entities.values.length;t++){let n=e.entities.values[t];n.polygon&&(n.polygon.extrudedHeight=8,n.polygon.height=1)}F.show=!1}),document.getElementById(`tab-b`).addEventListener(`click`,()=>{document.getElementById(`tab-b`).classList.add(`active`),document.getElementById(`tab-a`).classList.remove(`active`),document.getElementById(`content-b`).classList.add(`active`),document.getElementById(`content-a`).classList.remove(`active`),A&&(A=!1,M.textContent=`Play Simulation`),k&&k.stop(),F&&(F.show=!1),C()}),document.getElementById(`tab-a`).addEventListener(`click`,()=>{document.getElementById(`tab-a`).classList.add(`active`),document.getElementById(`tab-b`).classList.remove(`active`),document.getElementById(`content-a`).classList.add(`active`),document.getElementById(`content-b`).classList.remove(`active`),_.show=!1,F&&(F.show=j)}),N.addEventListener(`change`,e=>{document.getElementById(`tab-a`).classList.contains(`active`)&&F&&(F.show=e.target.checked)});