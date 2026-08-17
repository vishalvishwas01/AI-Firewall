import { useEffect, useRef } from "react";
import * as THREE from "three";

export function LivingFirewall() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const pointLight = new THREE.PointLight(0xffffff, 1);
    pointLight.position.set(5, 5, 5);
    scene.add(pointLight);

    const group = new THREE.Group();
    const shieldGeometry = new THREE.IcosahedronGeometry(1, 1);
    const shieldMaterial = new THREE.MeshPhongMaterial({
      color: 0x4a4741,
      wireframe: true,
      transparent: true,
      opacity: 0.8,
    });
    group.add(new THREE.Mesh(shieldGeometry, shieldMaterial));

    const coreGeometry = new THREE.IcosahedronGeometry(0.5, 0);
    const coreMaterial = new THREE.MeshPhongMaterial({
      color: 0xffffff,
      emissive: 0xfaf9f6,
      emissiveIntensity: 0.8,
      shininess: 100,
    });
    group.add(new THREE.Mesh(coreGeometry, coreMaterial));
    scene.add(group);
    camera.position.z = 3;

    const resize = () => {
      const width = Math.max(container.clientWidth, 1);
      const height = Math.max(container.clientHeight, 1);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let animationFrame = 0;
    const animate = (time: number) => {
      if (!reducedMotion) {
        group.rotation.y += 0.005;
        group.rotation.x += 0.002;
        const pulse = Math.sin(time * 0.002) * 0.1 + 1;
        group.scale.setScalar(pulse);
      }
      renderer.render(scene, camera);
      animationFrame = window.requestAnimationFrame(animate);
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    resize();
    animationFrame = window.requestAnimationFrame(animate);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      shieldGeometry.dispose();
      shieldMaterial.dispose();
      coreGeometry.dispose();
      coreMaterial.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div ref={containerRef} className="auth-firewall" aria-hidden="true" />;
}
