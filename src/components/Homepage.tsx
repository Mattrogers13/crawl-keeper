import manifest from "../../public/manifest.json";

// Shown when the page is opened outside Owlbear (no ?obrref): the extension's
// public homepage. Owlbear's install flow needs the manifest URL, so show it.
const Homepage = () => {
  const manifestUrl = `${window.location.origin}/manifest.json`;
  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="mb-2 text-3xl font-bold">{manifest.name}</h1>
      <p className="mb-6 text-obr-text-secondary">{manifest.description}</p>
      <h2 className="mb-2 text-xl font-semibold">Install</h2>
      <p className="mb-2">
        In Owlbear Rodeo, add a custom extension with this manifest URL:
      </p>
      <code className="block rounded bg-obr-bg p-2 break-all">{manifestUrl}</code>
    </main>
  );
};

export default Homepage;
