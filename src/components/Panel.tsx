import Loading from "./Loading";
import Tracker from "./Tracker";
import type { Role } from "../hooks/useRole";
import { useSceneReady } from "../hooks/useScene";
import { VERSION } from "../version";

const Panel = ({ role }: { role: Role }) => {
  const scene = useSceneReady();

  return (
    <div className="flex min-h-screen flex-col gap-3 p-3">
      <h1 className="text-lg font-semibold">Crawl Keeper</h1>
      {scene.ready === null ? (
        <Loading />
      ) : scene.ready ? (
        // A new key per opened scene: switching maps reads the new map fresh.
        <Tracker key={scene.opened} role={role} />
      ) : (
        <p className="text-sm text-obr-text-secondary">Open a scene to use the tracker.</p>
      )}
      <Footer />
    </div>
  );
};

const Footer = () => (
  <footer className="mt-auto text-xs text-obr-text-secondary">
    v{VERSION}
    {import.meta.env.VITE_BUILD_LABEL && <div>{import.meta.env.VITE_BUILD_LABEL}</div>}
  </footer>
);

export default Panel;
