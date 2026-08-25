import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';

export function setupEffects(scene, camera, renderer) {
  /* ── atmosphere ── */
  scene.fog = new THREE.FogExp2(0x05050c, 0.036);
  scene.background = new THREE.Color(0x030308);

  /* ── base lighting: cold night ambience ── */
  const ambient = new THREE.AmbientLight(0x3a4a66, 0.68);
  scene.add(ambient);

  const hemi = new THREE.HemisphereLight(0x25314a, 0x120d0a, 0.5);
  hemi.position.set(0, 4, 0);
  scene.add(hemi);

  // moonlight / city glow leaking through the window
  RectAreaLightUniformsLib.init();
  const windowLight = new THREE.RectAreaLight(0x5a74c8, 2.4, 2.4, 1.5);
  windowLight.position.set(-3.9, 1.65, -0.7);
  windowLight.lookAt(0.5, 0.8, -1.5);
  scene.add(windowLight);

  // soft fill so the wide shot never goes fully black
  const fill = new THREE.DirectionalLight(0x33415e, 0.35);
  fill.position.set(-2, 3, 2.5);
  scene.add(fill);

  /* ── post-processing ── */
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.62,   // strength — visible neon glow without soup
    0.55,   // radius
    0.72,   // threshold — only bright emissives bloom
  );
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;

  return { composer, bloom };
}

export function onResize(renderer, composer, camera) {
  const w = window.innerWidth;
  const h = window.innerHeight;

  camera.aspect = w / h;
  camera.updateProjectionMatrix();

  renderer.setSize(w, h);
  composer.setSize(w, h);
}
