import * as T from 'three';
import {KINDS,url,type Catalog,type DieAsset,type Kind,type Theme,type ThemeAudio} from './dice/types';

type SurfaceChannel='base_color'|'normal'|'orm'|'emissive';
export interface NativeTriangleSurface {
  textures:Record<SurfaceChannel,{file:string;sha256:string;strength:number}>;
  accent:{mode:string;target_digit:number;color_srgb:number[];cut_depth_ratios:Record<Kind,number>;feather_ratio:number};
  optics:{index_of_refraction:number;clearcoat_weight:number;clearcoat_roughness:number};
}
export type NativeTriangleTextures=Record<SurfaceChannel,T.Texture>;
const root='assets/themes/gray_red_three_cap/';

/** Adapt the existing native theme manifest; no authored replacement material or geometry. */
export async function loadTriangleTheme(catalog:Catalog):Promise<Theme> {
  const response=await fetch(url(root+'theme_manifest.json'));
  if(!response.ok)throw Error('三角机构主题清单加载失败');
  const m=await response.json();
  if(m.schema!=='desktop_dice.dice_theme.v7'||m.theme_id!=='gray_red_three_cap'||m.surface_channels.opacity.constant!==1||m.optics.transmission_weight!==0||m.body_accent.target_digit!==3||m.body_accent.cut_depth_ratios.d4!==.58)throw Error('三角机构主题与原软件合同不符');
  const masks=Object.fromEntries(KINDS.map(kind=>[kind,root+kind+'.png'])) as Record<Kind,string>;
  const audio:ThemeAudio={
    impacts:Object.fromEntries(['die_on_ground','die_on_die'].map(kind=>[kind,Object.fromEntries(['light','medium','heavy'].map(strength=>[strength,root+m.audio.impacts[kind][strength].file]))])) as ThemeAudio['impacts'],
    rolling:root+m.audio.rolling.file,tension:root+m.audio.dramatic.tension.file,
    natural_1:root+m.audio.dramatic.natural_1.file,natural_20:root+m.audio.dramatic.natural_20.file,mix:m.audio.mix,
  };
  for(const kind of KINDS)if(!catalog.dice[kind])throw Error('三角机构缺少原有模型：'+kind);
  return {id:'gray_red_three_cap',name:m.display_name,style:'ceramic',color:m.surface_channels.base_color.constant_srgb.slice(0,3),glyph:m.glyph_color_srgb.slice(0,3),roughness:m.surface_channels.roughness.constant,metalness:m.surface_channels.metallic.constant,masks,texture:root+m.surface_textures.base_color.file,audio,naturalOne:m.glyph_color_srgb.slice(0,3),naturalTwenty:m.glyph_color_srgb.slice(0,3),
    nativeSurface:{textures:m.surface_textures,accent:m.body_accent,optics:m.optics}};
}

export async function loadTriangleTextures(theme:Theme):Promise<NativeTriangleTextures> {
  const loader=new T.TextureLoader();
  const entries=await Promise.all((['base_color','normal','orm','emissive'] as const).map(async channel=>{
    const source=theme.nativeSurface!.textures[channel],path=url(root+source.file);
    const response=await fetch(path);if(!response.ok)throw Error('原有骰子贴图加载失败：'+channel);
    const bytes=await response.arrayBuffer();
    const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');
    if(hash!==source.sha256)throw Error('原有骰子贴图校验失败：'+channel);
    const objectURL=URL.createObjectURL(new Blob([bytes],{type:'image/png'}));
    let texture:T.Texture;try{texture=await loader.loadAsync(objectURL)}finally{URL.revokeObjectURL(objectURL)}
    texture.wrapS=texture.wrapT=T.RepeatWrapping;
    texture.flipY=false;texture.anisotropy=8;
    // Native base texture stores sRGB modulation around 0.5, decoded explicitly after mixing.
    texture.colorSpace=T.NoColorSpace;
    return [channel,texture] as const;
  }));
  return Object.fromEntries(entries) as NativeTriangleTextures;
}

/** Same radial triplanar sampling and outcome cap plane as the native renderer. */
export function createTriangleMaterial(theme:Theme,mask:T.Texture,geometry:T.BufferGeometry,asset:DieAsset,textures:NativeTriangleTextures):T.MeshPhysicalMaterial {
  const source=theme.nativeSurface!,accent=source.accent;
  const outcome=asset.outcomes.find(item=>item.value===(asset.kind==='d_percentile'?accent.target_digit*10:accent.target_digit));
  if(!outcome)throw Error('原有骰子缺少 3 号方向');
  const axis=new T.Vector3(...outcome.normal as [number,number,number]).normalize(),positions=geometry.getAttribute('position');
  let maximum=-Infinity;const point=new T.Vector3();
  for(let i=0;i<positions.count;i++)maximum=Math.max(maximum,point.fromBufferAttribute(positions,i).dot(axis)/asset.nominal);
  const threshold=maximum-accent.cut_depth_ratios[asset.kind];
  const material=new T.MeshPhysicalMaterial({color:new T.Color(...theme.color as [number,number,number]).convertSRGBToLinear(),roughness:theme.roughness,metalness:theme.metalness,ior:source.optics.index_of_refraction,clearcoat:source.optics.clearcoat_weight,clearcoatRoughness:source.optics.clearcoat_roughness,transparent:false,opacity:1,transmission:0});
  material.userData={glyphColor:{value:new T.Color(...theme.glyph as [number,number,number])},glyphOutline:{value:new T.Color(0)},glyphWipe:{value:-1},time:{value:0},playerTint:{value:0},nativeTheme:'gray_red_three_cap'};
  material.onBeforeCompile=function(shader:any) {
    Object.assign(shader.uniforms,{nativeBase:{value:textures.base_color},nativeNormal:{value:textures.normal},nativeOrm:{value:textures.orm},nativeEmissive:{value:textures.emissive},nativeMask:{value:mask},nativeAxis:{value:axis},nativeThreshold:{value:threshold},nativeNominal:{value:asset.nominal},nativeFeather:{value:accent.feather_ratio},nativeAccent:{value:new T.Vector3(...accent.color_srgb.slice(0,3) as [number,number,number])},nativeBody:{value:new T.Vector3(...theme.color as [number,number,number])},nativeGlyph:this.userData.glyphColor,nativeWipe:this.userData.glyphWipe,nativeStrengths:{value:new T.Vector4(source.textures.base_color.strength,source.textures.normal.strength,source.textures.orm.strength,source.textures.emissive.strength)}});
    shader.vertexShader='attribute vec2 diceGlyph;varying vec2 vNativeGlyph;varying vec3 vNativePosition;varying vec3 vNativeNormal;uniform float nativeNominal;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvNativeGlyph=diceGlyph;vNativePosition=position/nativeNominal;vNativeNormal=normal;');
    shader.fragmentShader=`uniform sampler2D nativeBase,nativeNormal,nativeOrm,nativeEmissive,nativeMask;
      uniform vec3 nativeAxis,nativeAccent,nativeBody,nativeGlyph;uniform float nativeThreshold,nativeFeather,nativeWipe;uniform vec4 nativeStrengths;
      varying vec2 vNativeGlyph;varying vec3 vNativePosition,vNativeNormal;
      vec3 nativeWeights(vec3 p){vec3 w=pow(abs(normalize(p)),vec3(4.));return w/max(dot(w,vec3(1.)),.000001);}
      vec4 nativeSample(sampler2D map,vec3 p){vec3 w=nativeWeights(p);return texture2D(map,p.zy+.5)*w.x+texture2D(map,p.xz+.5)*w.y+texture2D(map,p.xy+.5)*w.z;}
      vec3 nativeLinear(vec3 c){return mix(c/12.92,pow((c+.055)/1.055,vec3(2.4)),step(vec3(.04045),c));}
      vec3 nativeNormalDelta(vec3 p){
        vec3 w=nativeWeights(p),s=sign(p),nx=texture2D(nativeNormal,p.zy+.5).rgb*2.-1.,ny=texture2D(nativeNormal,p.xz+.5).rgb*2.-1.,nz=texture2D(nativeNormal,p.xy+.5).rgb*2.-1.;
        vec3 mapped=normalize(vec3(nx.z*s.x,nx.y,nx.x)*w.x+vec3(ny.x,ny.z*s.y,ny.y)*w.y+vec3(nz.x,nz.y,nz.z*s.z)*w.z);
        return mapped-normalize(s*w);
      }\n`+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      vec3 modulation=mix(vec3(1.),nativeSample(nativeBase,vNativePosition).rgb*2.,nativeStrengths.x);
      float cap=smoothstep(-nativeFeather,nativeFeather,dot(vNativePosition,nativeAxis)-nativeThreshold);
      float nativeInk=smoothstep(.40,.46,texture2D(nativeMask,vNativeGlyph).r);
      vec3 nativePigment=mix(nativeBody,nativeAccent,cap);
      diffuseColor.rgb=mix(nativeLinear(clamp(nativePigment*modulation,0.,1.)),nativeLinear(nativeGlyph),nativeInk);
      vec3 nativeORM=nativeSample(nativeOrm,vNativePosition).rgb;
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
      roughnessFactor=mix(roughnessFactor,nativeORM.g,nativeStrengths.z);
      roughnessFactor=mix(roughnessFactor,.3,nativeInk);
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <metalnessmap_fragment>',`#include <metalnessmap_fragment>
      metalnessFactor=mix(metalnessFactor,nativeORM.b,nativeStrengths.z)*(1.-nativeInk);
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
      vec3 localNormal=normalize(vNativeNormal),delta=nativeNormalDelta(vNativePosition);
      delta-=localNormal*dot(delta,localNormal);
      vec3 tx=dFdx(vNativePosition),ty=dFdy(vNativePosition),vx=dFdx(vViewPosition),vy=dFdy(vViewPosition);
      vec3 tangent=normalize(tx),bitangent=normalize(ty-tangent*dot(ty,tangent));
      vec3 mapped=normalize(vx)*dot(delta,tangent)+normalize(vy)*dot(delta,bitangent);
      normal=normalize(normal-mapped*nativeStrengths.y*(1.-nativeInk));
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
      totalEmissiveRadiance+=nativeLinear(nativeSample(nativeEmissive,vNativePosition).rgb)*nativeStrengths.w*(1.-nativeInk);
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <aomap_fragment>',`#include <aomap_fragment>
      reflectedLight.indirectDiffuse*=mix(1.,nativeORM.r,nativeStrengths.z);
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <colorspace_fragment>',`#include <colorspace_fragment>
      float wipe=nativeWipe>=0.?1.-smoothstep(.025,.115,abs(dot(vNativeGlyph,vec2(.72,.28))-nativeWipe)):0.;
      vec3 pigment=mix(nativeGlyph,vec3(1.),wipe*.82);
      gl_FragColor.rgb=mix(gl_FragColor.rgb,pigment,nativeInk*.78);
    `);
  };
  material.customProgramCacheKey=()=>`native-gray-red-three-cap-v1-${asset.kind}`;
  return material;
}
