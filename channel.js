/* Terrain: continuous 16-bit field, coloured dither at screen resolution.
   Artwork and adaptive HTML lettering use the same rendered frame.
   Parameters and source: docs/design-direction.md; atlas: scripts/build_channel_field.cjs. */
(() => {
  const panel = document.querySelector('.channel-note');
  if (!panel || !CSS.supports('background-clip', 'text')) return;
  const control = panel.querySelector('.channel-motion');
  if (!control) return;
  const label = control.querySelector('.link-label');
  const symbol = control.querySelector('use');
  const fields = [...panel.querySelectorAll('.channel-kicker,.channel-title,.channel-copy,.channel-link .link-label'), label];
  const icons = [...panel.querySelectorAll('.link-icon')];
  const art = document.createElement('canvas');
  art.className = 'channel-moving-art'; art.setAttribute('aria-hidden', 'true');
  const gl = art.getContext('webgl', { alpha: false, antialias: false, preserveDrawingBuffer: true });
  if (!gl || !gl.getExtension('OES_standard_derivatives')) return;
  const vertex = `attribute vec2 point; varying vec2 uv;
    void main(){uv=vec2(point.x*.5+.5,.5-point.y*.5);gl_Position=vec4(point,0.,1.);}`;
  const fragment = `#extension GL_OES_standard_derivatives : enable
    precision highp float;
    varying vec2 uv;
    uniform sampler2D atlas,textMask;
    uniform vec2 crop,offset;
    uniform float phase,amount;
    float field(float tile,vec2 at){
      vec2 origin=vec2(mod(tile,13.),floor(tile/13.));
      vec2 p=(origin*vec2(192.,108.)+.5+clamp(at,0.,1.)*vec2(191.,107.))/vec2(2496.,756.);
      vec2 code=texture2D(atlas,p).rg;
      return dot(code,vec2(65280.,255.))/65535.;
    }
    vec3 ink(float band){
      if(band<.5)return vec3(244.,243.,238.)/255.;
      if(band<1.5)return vec3(169.,219.,227.)/255.;
      if(band<2.5)return vec3(196.,185.,255.)/255.;
      if(band<3.5)return vec3(35.,76.,232.)/255.;
      if(band<4.5)return vec3(16.,18.,22.)/255.;
      return vec3(233.,255.,100.)/255.;
    }
    float luminosity(vec3 c){
      vec3 lo=c/12.92,hi=pow((c+.055)/1.055,vec3(2.4));
      return dot(mix(lo,hi,step(vec3(.04045),c)),vec3(.2126,.7152,.0722));
    }
    float random(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    void main(){
      vec2 at=uv*crop+offset;
      float a=floor(phase),b=mod(a+1.,90.);
      float dynamic=mix(field(a+1.,at),field(b+1.,at),fract(phase));
      float value=mix(field(0.,at),dynamic,amount);
      float baseBand=clamp(floor(value*6.),0.,5.);
      vec3 base=ink(baseBand);
      // The native dither perturbs the field before choosing an ink, rather than
      // placing grey noise over it. Preserve its full ink mixing in the artwork.
      float grain=(random(floor(gl_FragCoord.xy))-.5)*.30;
      float band=clamp(floor((value+grain)*6.),0.,5.);
      vec3 speck=ink(band);
      // Protect only the actual HTML glyph strokes, not their rectangular boxes:
      // fine contrasting specks cannot punch holes through readable lettering.
      if(texture2D(textMask,uv).a>.01 && (luminosity(base)>.179)!=(luminosity(speck)>.179))speck=base;
      float edge=max(fwidth(value)*.75,.00002);
      float boundary=(baseBand+1.)/6.;
      vec3 next=ink(min(baseBand+1.,5.));
      if(texture2D(textMask,uv).a>.01 && (luminosity(base)>.179)!=(luminosity(next)>.179)){
        float mixEdge=smoothstep(boundary-edge,boundary+edge,value);
        speck=mix(speck,next,mixEdge);
      }
      gl_FragColor=vec4(speck,1.);
    }`;
  const program = gl.createProgram();
  for (const [type, source] of [[gl.VERTEX_SHADER, vertex], [gl.FRAGMENT_SHADER, fragment]]) {
    const shader = gl.createShader(type); gl.shaderSource(shader, source); gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return;
    gl.attachShader(program, shader);
  }
  gl.linkProgram(program); if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
  gl.useProgram(program);
  const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW);
  const point = gl.getAttribLocation(program, 'point'); gl.enableVertexAttribArray(point); gl.vertexAttribPointer(point,2,gl.FLOAT,false,0,0);
  const uniform = name => gl.getUniformLocation(program,name);
  const texture = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,texture);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
  gl.uniform1i(uniform('atlas'),0);
  gl.activeTexture(gl.TEXTURE1);
  const glyphTexture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,glyphTexture);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  gl.uniform1i(uniform('textMask'),1);
  panel.prepend(art);
  const map = document.createElement('canvas'), context = map.getContext('2d',{willReadFrequently:true});
  const glyphs=document.createElement('canvas'),glyphContext=glyphs.getContext('2d');
  if (!context || !glyphContext) return;
  const source = new Image();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)'), forced = matchMedia('(forced-colors: active)');
  const linear = Array.from({length:256},(_,i)=>{const c=i/255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4;});
  let ready=false,nearby=false,playing=false,raf=0,pending=false,last=0,elapsed=0,motionStarted=false,cached='',glyphCache='';
  function sync() {
    control.hidden=!ready||reduced.matches||forced.matches;
    control.setAttribute('aria-pressed',String(playing));
    label.textContent=playing?'Остановить фон':'Оживить фон';
    glyphCache='';cached='';
    symbol.setAttribute('href',symbol.getAttribute('href').replace(/#.*$/,playing?'#player-pause':'#player-play'));
  }
  function stop(){playing=false;cancelAnimationFrame(raf);raf=0;sync();schedule();}
  function glyphMask(r,density){
    const key=[r.width,r.height,density,label.textContent].join(':');if(key===glyphCache)return;
    glyphs.width=art.width;glyphs.height=art.height;
    glyphContext.setTransform(density,0,0,density,0,0);
    glyphContext.fillStyle='#000';glyphContext.strokeStyle='#000';glyphContext.lineWidth=.5;
    glyphContext.shadowColor='#000';glyphContext.shadowBlur=.5*density;
    for(const field of fields){
      const style=getComputedStyle(field);
      glyphContext.font=`${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      const metrics=glyphContext.measureText('Hgy');
      const ascent=metrics.fontBoundingBoxAscent||parseFloat(style.fontSize)*.8;
      const descent=metrics.fontBoundingBoxDescent||parseFloat(style.fontSize)*.2;
      const walker=document.createTreeWalker(field,NodeFilter.SHOW_TEXT);
      let node;
      while(node=walker.nextNode())for(let i=0;i<node.textContent.length;i++){
        let char=node.textContent[i];if(!char.trim())continue;
        if(style.textTransform==='uppercase')char=char.toUpperCase();
        const range=document.createRange();range.setStart(node,i);range.setEnd(node,i+1);
        const rect=range.getBoundingClientRect();if(!rect.width||!rect.height)continue;
        const x=rect.left-r.left,y=rect.top-r.top+(rect.height-ascent-descent)/2+ascent;
        glyphContext.strokeText(char,x,y);glyphContext.fillText(char,x,y);
      }
    }
    gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,glyphTexture);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,glyphs);glyphCache=key;
  }
  function paint() {
    pending=false;if(!ready||!nearby||forced.matches)return;
    const r=panel.getBoundingClientRect();if(r.width<1||r.height<1)return;
    const density=Math.min(devicePixelRatio||1,2),ratio=Math.min(1,1600/r.width);
    const position=parseFloat(getComputedStyle(panel).getPropertyValue('--channel-art-x'))/100||.5;
    const state=[r.width,r.height,density,position,elapsed].join(':');if(state===cached)return;
    const began=performance.now();
    try {
      const w=Math.ceil(r.width*density),h=Math.ceil(r.height*density);
      if(art.width!==w||art.height!==h){art.width=w;art.height=h;}
      glyphMask(r,density);
      gl.viewport(0,0,w,h);
      const cover=Math.max(w/16,h/9),cx=w/(16*cover),cy=h/(9*cover);
      gl.uniform2f(uniform('crop'),cx,cy);gl.uniform2f(uniform('offset'),(1-cx)*position,(1-cy)/2);
      gl.uniform1f(uniform('phase'),elapsed%12000/12000*90);
      const blend=Math.min(1,elapsed/850);gl.uniform1f(uniform('amount'),blend*blend*(3-2*blend));
      gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
      if(gl.isContextLost())throw Error('Lost artwork');
      map.width=Math.ceil(r.width*ratio);map.height=Math.ceil(r.height*ratio);
      context.drawImage(art,0,0,map.width,map.height);
      const pixels=context.getImageData(0,0,map.width,map.height);
      for(let i=0;i<pixels.data.length;i+=4){
        const light=.2126*linear[pixels.data[i]]+.7152*linear[pixels.data[i+1]]+.0722*linear[pixels.data[i+2]];
        const value=light>.179?0:255;
        pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=value;
      }
      context.putImageData(pixels,0,0);
      const image=`url(${map.toDataURL('image/png')})`;
      for(const field of fields){
        const f=field.getBoundingClientRect();
        field.style.setProperty('--terrain-contrast-image',image);
        field.style.setProperty('--terrain-contrast-size',`${r.width}px ${r.height}px`);
        field.style.setProperty('--terrain-contrast-position',`${r.left-f.left}px ${r.top-f.top}px`);
        field.classList.add('channel-contrast-text');
      }
      for(const icon of icons){
        const f=icon.getBoundingClientRect();
        const x=Math.max(0,Math.min(map.width-1,Math.round((f.left+f.width/2-r.left)*ratio)));
        const y=Math.max(0,Math.min(map.height-1,Math.round((f.top+f.height/2-r.top)*ratio)));
        const colour=context.getImageData(x,y,1,1).data[0];icon.style.setProperty('--channel-icon-color',`rgb(${colour},${colour},${colour})`);
      }
      cached=state;panel.classList.add('is-contrast-ready');
      panel.dataset.motionFrame=motionStarted?(elapsed/1000).toFixed(3):'still';
      panel.dataset.motionPaintMs=(performance.now()-began).toFixed(1);
    } catch {
      fallback();
    }
  }
  function schedule(){if(!pending){pending=true;requestAnimationFrame(paint);}}
  function tick(now){
    if(!playing)return;
    const step=now-last;
    if(step>=1000/30){elapsed+=Math.min(step,100);last=now;paint();}
    raf=requestAnimationFrame(tick);
  }
  control.addEventListener('click',()=>{
    if(playing){stop();return;}if(!ready||reduced.matches||forced.matches)return;
    playing=true;motionStarted=true;last=performance.now();sync();raf=requestAnimationFrame(tick);
  });
  function fallback(){
    ready=false;stop();panel.classList.remove('is-contrast-ready');
    for(const icon of icons)icon.style.removeProperty('--channel-icon-color');
  }
  art.addEventListener('webglcontextlost',fallback);
  source.addEventListener('load',()=>{
    try {
      gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);
      if(gl.isContextLost())throw Error('Lost artwork');
      ready=true;sync();schedule();
    } catch {fallback();}
  });
  source.addEventListener('error',fallback);
  function load(){if(!source.getAttribute('src'))source.src='assets/illustrations/channel-terrain-field.png';schedule();}
  if('IntersectionObserver'in window)new IntersectionObserver(entries=>{
    nearby=entries[0].isIntersecting;if(nearby)load();else stop();
  },{rootMargin:'400px'}).observe(panel);else{nearby=true;load();}
  if('IntersectionObserver'in window)new IntersectionObserver(entries=>{if(!entries[0].isIntersecting)stop();}).observe(panel);
  if('ResizeObserver'in window)new ResizeObserver(schedule).observe(panel);
  for(const setting of [reduced,forced])setting.addEventListener('change',()=>{stop();cached='';schedule();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
  document.fonts?.ready.then(()=>{glyphCache='';cached='';schedule();});window.addEventListener('resize',schedule);sync();
})();
