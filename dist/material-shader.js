import {DITHER_PATTERNS} from './dither.js';

// Material identity comes from the separately painted, alpha-clipped surface
// map. No part of this shader tries to infer a material from a scene's colors.
export const MATERIAL_LIMITS=Object.freeze({objectShadow:.16,foliageShadow:.20,maxLightOpacity:.25,lightDensity:.64});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const number=(v,fallback)=>Number.isFinite(Number(v))?Number(v):fallback;
const strength=(v,fallback)=>clamp(number(v,fallback),0,1);
const patternIndex=id=>Math.max(0,DITHER_PATTERNS.findIndex(p=>p.id===id));

export function normalizeLighting(moon={},ray={}){
  const x=number(moon.x,0),y=number(moon.y,0),r=Math.max(0,number(moon.r,0));
  const dx=number(ray.targetX,x)-x,dy=number(ray.targetY,y)-y,length=Math.hypot(dx,dy);
  return{
    moon:[x,y,r],direction:length>1?[dx/length,dy/length]:[0,1],
    length:Math.max(1,length),width:Math.max(1,number(ray.width,120)),
    power:length>r+2?clamp(number(ray.power,.22),0,MATERIAL_LIMITS.maxLightOpacity):0,
    pixelSize:clamp(number(ray.pixelSize,1),1,4)
  };
}

// Compile small ordered matrices into GLSL. They are mathematical threshold
// fields, not images of rays. Grain uses a fixed coordinate hash instead.
function orderedFunction(pattern){
  const size=pattern.size;
  const scalar=v=>((v+.5)/256).toFixed(8);
  let body=`float ordered_${pattern.id}(vec2 p){vec2 q=mod(floor(p),${size}.0);`;
  for(let y=0;y<size;y++){
    body+=`${y?'else ':''}if(q.y<${y+1}.0){`;
    for(let x=0;x<size-1;x++)body+=`${x?'else ':''}if(q.x<${x+1}.0)return ${scalar(pattern.data[y*size+x])};`;
    body+=`return ${scalar(pattern.data[y*size+size-1])};}`;
  }
  return body+'return 0.5;}';
}

const VERTEX=`attribute vec2 aPosition;
varying vec2 vUv;
void main(){vUv=(aPosition+1.0)*0.5;gl_Position=vec4(aPosition,0.0,1.0);}`;

const FRAGMENT=`precision highp float;
varying vec2 vUv;
uniform sampler2D uScene;
uniform sampler2D uSurfaces;
uniform vec2 uSize;
uniform vec3 uMoon;
uniform vec2 uRayDirection;
uniform vec4 uRay; // length, terminal full width, maximum opacity, pattern pixel size
uniform vec3 uAmounts; // objects, foliage, light
uniform int uLightPattern;
uniform int uHighlight;

${DITHER_PATTERNS.filter(p=>p.id!=='grain').map(orderedFunction).join('\n')}

float lightThreshold(vec2 p){
  if(uLightPattern==1)return ordered_checker(p);
  if(uLightPattern==2)return ordered_diagonal(p);
  if(uLightPattern==3)return ordered_dots(p);
  if(uLightPattern==4)return ordered_weave(p);
  if(uLightPattern==5){vec2 q=floor(p);return 0.003+fract(sin(dot(q,vec2(127.1,311.7)))*43758.5453)*0.994;}
  return ordered_bayer(p);
}

float coneCoverage(vec2 p){
  vec2 delta=p-uMoon.xy;
  float along=dot(delta,uRayDirection);
  float radius=uMoon.z;
  // The moon cannot dither itself; neither can a beam extend behind its source.
  if(uRay.z<=0.0||length(delta)<=radius+1.0||along<=radius*0.8||along>=uRay.x)return 0.0;
  float t=clamp(along/uRay.x,0.0,1.0);
  float halfWidth=max(2.0,mix(radius*0.42,uRay.y*0.5,t));
  float lateral=abs(dot(delta,vec2(-uRayDirection.y,uRayDirection.x)));
  float edge=1.0-smoothstep(halfWidth*0.68,halfWidth+1.5,lateral);
  float begin=smoothstep(max(1.0,radius*0.8),max(2.0,radius*1.55),along);
  float end=1.0-smoothstep(uRay.x*0.64,uRay.x,along);
  float falloff=mix(1.0,0.64,t);
  return edge*begin*end*falloff*${MATERIAL_LIMITS.lightDensity.toFixed(2)};
}

void main(){
  vec3 original=texture2D(uScene,vUv).rgb;
  vec4 surface=texture2D(uSurfaces,vUv);
  float code=surface.r*255.0;
  float isObject=(abs(code-85.0)<0.6&&surface.a>0.99)?1.0:0.0;
  float isFoliage=(abs(code-170.0)<0.6&&surface.a>0.99)?1.0:0.0;
  float coverage=clamp(surface.g,0.0,1.0);
  float threshold=(surface.b*255.0+0.5)/256.0;
  float objectShade=mix(coverage,step(threshold,coverage),uAmounts.x)*isObject;
  float foliageShade=mix(coverage,step(threshold,coverage),uAmounts.y)*isFoliage;
  // Only interpolate between the base material and one restrained shadow tone.
  // Independent RGB quantization would alter hues and damage the art palette.
  vec3 color=original*(1.0-objectShade*${MATERIAL_LIMITS.objectShadow.toFixed(2)}-foliageShade*${MATERIAL_LIMITS.foliageShadow.toFixed(2)});
  vec2 world=vec2(gl_FragCoord.x,uSize.y-gl_FragCoord.y);
  float beam=coneCoverage(world);
  float patterned=step(lightThreshold(world/uRay.w),beam);
  // Explicit support mask is required: zero-coverage pixels must remain zero
  // even with a threshold pattern containing a minimum-valued cell.
  if(beam<=0.0)patterned=0.0;
  float opacity=mix(beam,patterned,uAmounts.z)*uRay.z;
  color+=(1.0-color)*vec3(1.0,0.79,0.39)*opacity;
  if(uHighlight==1)color=mix(original*0.17,vec3(1.0,0.72,0.30),isObject*0.88);
  else if(uHighlight==2)color=mix(original*0.17,vec3(0.27,1.0,0.73),isFoliage*0.88);
  else if(uHighlight==3)color=mix(original*0.17,vec3(1.0,0.79,0.39),clamp(beam/${MATERIAL_LIMITS.lightDensity.toFixed(2)},0.0,1.0)*0.9);
  gl_FragColor=vec4(clamp(color,0.0,1.0),1.0);
}`;

export class MaterialShader{
  constructor(){
    this.canvas=document.createElement('canvas');this.canvas.width=1;this.canvas.height=1;
    this.backend='unavailable';this.error=null;this.lost=false;
    this.canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();this.lost=true;this.backend='unavailable';this.error='The graphics context was lost; the unfiltered scene remains available.';});
    this.canvas.addEventListener('webglcontextrestored',()=>{this.lost=false;this.initialize();});
    this.initialize();
  }
  initialize(){
    try{
      this.gl=this.canvas.getContext('webgl',{alpha:false,antialias:false,premultipliedAlpha:false,preserveDrawingBuffer:true,depth:false,stencil:false});
      if(!this.gl)throw new Error('WebGL is unavailable; displaying the original scene without shader effects.');
      this.setup();this.backend='webgl';this.error=null;
    }catch(error){this.backend='unavailable';this.error=error?.message||String(error);}
  }
  setup(){
    const gl=this.gl;
    const compile=(type,source)=>{
      const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);
      if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){const message=gl.getShaderInfoLog(shader);gl.deleteShader(shader);throw new Error(`Material shader compilation failed: ${message}`);}
      return shader;
    };
    const vertex=compile(gl.VERTEX_SHADER,VERTEX),fragment=compile(gl.FRAGMENT_SHADER,FRAGMENT),program=gl.createProgram();
    gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);gl.deleteShader(vertex);gl.deleteShader(fragment);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS)){const message=gl.getProgramInfoLog(program);gl.deleteProgram(program);throw new Error(`Material shader linking failed: ${message}`);}
    this.program=program;gl.useProgram(program);
    this.buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
    this.position=gl.getAttribLocation(program,'aPosition');gl.enableVertexAttribArray(this.position);gl.vertexAttribPointer(this.position,2,gl.FLOAT,false,0,0);
    this.uniforms=Object.fromEntries(['uScene','uSurfaces','uSize','uMoon','uRayDirection','uRay','uAmounts','uLightPattern','uHighlight'].map(name=>[name,gl.getUniformLocation(program,name)]));
    this.textures=[0,1].map(unit=>{const texture=gl.createTexture();gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);return texture;});
    gl.uniform1i(this.uniforms.uScene,0);gl.uniform1i(this.uniforms.uSurfaces,1);
    gl.disable(gl.BLEND);gl.disable(gl.DEPTH_TEST);gl.disable(gl.DITHER);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL,gl.NONE);
    this.textureWidth=0;this.textureHeight=0;
  }
  render({scene,surfaces,width=scene.width,height=scene.height,moon,ray,settings={},mode='dither',highlight=null}){
    if(this.backend!=='webgl'||this.lost)return scene;
    const gl=this.gl;
    try{
      width=Math.max(1,Math.round(width));height=Math.max(1,Math.round(height));
      if(scene.width!==width||scene.height!==height||surfaces?.width!==width||surfaces?.height!==height)throw new Error('The scene and material surface map must have identical native dimensions.');
      if(this.canvas.width!==width||this.canvas.height!==height){this.canvas.width=width;this.canvas.height=height;}
      gl.useProgram(this.program);gl.viewport(0,0,width,height);
      gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.enableVertexAttribArray(this.position);gl.vertexAttribPointer(this.position,2,gl.FLOAT,false,0,0);
      const resize=width!==this.textureWidth||height!==this.textureHeight;
      [scene,surfaces].forEach((source,unit)=>{
        gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,this.textures[unit]);
        if(resize)gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,width,height,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
        gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,gl.RGBA,gl.UNSIGNED_BYTE,source);
      });
      this.textureWidth=width;this.textureHeight=height;
      const lighting=normalizeLighting(moon,ray),amount=mode==='dither'?1:0,u=this.uniforms;
      gl.uniform2f(u.uSize,width,height);gl.uniform3fv(u.uMoon,lighting.moon);gl.uniform2fv(u.uRayDirection,lighting.direction);
      gl.uniform4f(u.uRay,lighting.length,lighting.width,lighting.power,lighting.pixelSize);
      gl.uniform3f(u.uAmounts,strength(settings.objects?.strength,.45)*amount,strength(settings.foliage?.strength,.45)*amount,strength(settings.light?.strength,.75)*amount);
      gl.uniform1i(u.uLightPattern,patternIndex(settings.light?.pattern||'weave'));
      gl.uniform1i(u.uHighlight,{objects:1,foliage:2,light:3}[highlight]||0);
      gl.drawArrays(gl.TRIANGLES,0,6);
      return this.canvas;
    }catch(error){this.error=error?.message||String(error);this.backend='unavailable';return scene;}
  }
}
