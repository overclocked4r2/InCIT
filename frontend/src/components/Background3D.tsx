import { useEffect, useRef } from 'react';
import type * as Three from 'three';

type FloatingShape = {
  group: Three.InstancedMesh;
  instance: number;
  x: number;
  y: number;
  z: number;
  size: number;
  rotationX: number;
  rotationY: number;
  speedX: number;
  speedY: number;
  phase: number;
};

export function Background3D() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    let cleanup: (() => void) | undefined;

    const initialize = async () => {
      const THREE = await import('three');
      if (cancelled || !hostRef.current) return;

      const isMobile = window.innerWidth < 680 || window.matchMedia('(pointer: coarse)').matches;
      let renderer: Three.WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({
          alpha: true,
          antialias: !isMobile,
          powerPreference: 'low-power',
        });
      } catch {
        // Keep all scheduling and booking features usable when WebGL is unavailable.
        return;
      }

      renderer.setPixelRatio(isMobile ? 0.75 : Math.min(window.devicePixelRatio || 1, 1));
      renderer.setClearColor(0x000000, 0);
      renderer.domElement.setAttribute('aria-hidden', 'true');
      renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;pointer-events:none;';
      host.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
      camera.position.z = 14;

      const geometries = [
        new THREE.IcosahedronGeometry(1, 0),
        new THREE.OctahedronGeometry(1, 0),
        new THREE.BoxGeometry(1.35, 1.35, 1.35),
      ];
      const materials = [0, 1].map(() => new THREE.MeshBasicMaterial({
        wireframe: true,
        transparent: true,
        opacity: 0.14,
        depthWrite: false,
      }));
      const count = isMobile ? 6 : 12;
      const groupCounts = geometries.map((_, shape) => Math.ceil((count - shape) / geometries.length));
      const groups = geometries.map((geometry, index) => new THREE.InstancedMesh(
        geometry,
        materials[index === 2 ? 1 : 0],
        groupCounts[index],
      ));
      groups.forEach(group => scene.add(group));

      const objects: FloatingShape[] = [];
      const nextInstance = [0, 0, 0];
      const dummy = new THREE.Object3D();
      let seed = 0xc17;
      const random = () => {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 4294967296;
      };

      for (let i = 0; i < count; i += 1) {
        const shape = i % geometries.length;
        const group = groups[shape];
        const instance = nextInstance[shape]++;
        const item: FloatingShape = {
          group,
          instance,
          x: (random() - 0.5) * 25,
          y: (random() - 0.5) * 14,
          z: -8 + random() * 8,
          size: 0.38 + random() * 0.78,
          rotationX: random() * Math.PI * 2,
          rotationY: random() * Math.PI * 2,
          speedX: (random() - 0.5) * 0.18,
          speedY: (random() - 0.5) * 0.2,
          phase: random() * Math.PI * 2,
        };
        objects.push(item);
        dummy.position.set(item.x, item.y, item.z);
        dummy.rotation.set(item.rotationX, item.rotationY, 0);
        dummy.scale.setScalar(item.size);
        dummy.updateMatrix();
        group.setMatrixAt(instance, dummy.matrix);
      }
      groups.forEach(group => { group.instanceMatrix.needsUpdate = true; });

      let pointerX = 0;
      let pointerY = 0;
      let elapsed = 0;
      let lastFrame = 0;
      let raf = 0;
      let frameTimer = 0;
      let running = false;
      const frameInterval = isMobile ? 66 : 42;
      const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
      let reduceMotion = motionPreference.matches;

      const recolor = () => {
        const root = document.documentElement;
        const styles = getComputedStyle(root);
        const accent = styles.getPropertyValue('--accent').trim() || '#7c83ff';
        const accent2 = styles.getPropertyValue('--accent-2').trim() || '#34d3c0';
        const opacity = root.dataset.theme === 'light' ? 0.085 : 0.14;
        materials[0].color.set(accent);
        materials[1].color.set(accent2);
        materials.forEach(material => { material.opacity = opacity; });
        if (reduceMotion) renderer.render(scene, camera);
      };

      const resize = () => {
        const width = host.clientWidth || window.innerWidth;
        const height = host.clientHeight || window.innerHeight;
        if (!width || !height) return;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height, false);
        if (reduceMotion) renderer.render(scene, camera);
      };

      const renderFrame = (now: number) => {
        if (!running || reduceMotion || document.hidden) return;
        const delta = Math.min(now - lastFrame || frameInterval, 80) / 1000;
        lastFrame = now;
        elapsed += delta * 0.55;
        objects.forEach(item => {
          item.rotationX += item.speedX * delta;
          item.rotationY += item.speedY * delta;
          dummy.position.set(item.x, item.y + Math.sin(elapsed + item.phase) * 0.42, item.z);
          dummy.rotation.set(item.rotationX, item.rotationY, 0);
          dummy.scale.setScalar(item.size);
          dummy.updateMatrix();
          item.group.setMatrixAt(item.instance, dummy.matrix);
        });
        groups.forEach(group => { group.instanceMatrix.needsUpdate = true; });
        const ease = 1 - Math.exp(-delta * 3);
        camera.position.x += (pointerX * 2.8 - camera.position.x) * ease;
        camera.position.y += (-pointerY * 1.8 - camera.position.y) * ease;
        camera.lookAt(0, 0, 0);
        renderer.render(scene, camera);
        frameTimer = window.setTimeout(() => {
          raf = window.requestAnimationFrame(renderFrame);
        }, frameInterval);
      };

      const start = () => {
        if (running || reduceMotion || document.hidden) return;
        running = true;
        lastFrame = 0;
        raf = window.requestAnimationFrame(renderFrame);
      };
      const stop = () => {
        running = false;
        if (raf) window.cancelAnimationFrame(raf);
        if (frameTimer) window.clearTimeout(frameTimer);
        raf = 0;
        frameTimer = 0;
      };
      const onPointerMove = (event: PointerEvent) => {
        if (event.pointerType !== 'mouse' || reduceMotion) return;
        pointerX = event.clientX / window.innerWidth - 0.5;
        pointerY = event.clientY / window.innerHeight - 0.5;
      };
      const onVisibilityChange = () => document.hidden ? stop() : start();
      const onMotionChange = (event: MediaQueryListEvent) => {
        reduceMotion = event.matches;
        if (reduceMotion) {
          stop();
          renderer.render(scene, camera);
        } else start();
      };
      const onContextLost = (event: Event) => {
        event.preventDefault();
        stop();
      };
      const onContextRestored = () => {
        resize();
        start();
      };

      const resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(host);
      const themeObserver = new MutationObserver(recolor);
      themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-palette', 'data-theme'] });
      document.addEventListener('visibilitychange', onVisibilityChange);
      window.addEventListener('pointermove', onPointerMove, { passive: true });
      window.addEventListener('resize', resize, { passive: true });
      motionPreference.addEventListener('change', onMotionChange);
      renderer.domElement.addEventListener('webglcontextlost', onContextLost);
      renderer.domElement.addEventListener('webglcontextrestored', onContextRestored);

      resize();
      recolor();
      if (reduceMotion) renderer.render(scene, camera);
      else start();

      cleanup = () => {
        stop();
        resizeObserver.disconnect();
        themeObserver.disconnect();
        document.removeEventListener('visibilitychange', onVisibilityChange);
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('resize', resize);
        motionPreference.removeEventListener('change', onMotionChange);
        renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
        renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored);
        geometries.forEach(geometry => geometry.dispose());
        materials.forEach(material => material.dispose());
        renderer.dispose();
        renderer.domElement.remove();
      };
    };

    const begin = () => { void initialize().catch(() => undefined); };
    const idleWindow = window as unknown as {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    let idleHandle: number | undefined;
    let timeoutHandle = 0;
    if (idleWindow.requestIdleCallback) idleHandle = idleWindow.requestIdleCallback(begin, { timeout: 1200 });
    else timeoutHandle = window.setTimeout(begin, 160);

    return () => {
      cancelled = true;
      if (idleHandle !== undefined) idleWindow.cancelIdleCallback?.(idleHandle);
      if (timeoutHandle) window.clearTimeout(timeoutHandle);
      cleanup?.();
    };
  }, []);

  return <div id="bg3d" ref={hostRef} aria-hidden="true" />;
}
