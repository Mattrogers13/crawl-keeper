import { useEffect, useState } from "react";
import OBR from "@owlbear-rodeo/sdk";

import Loading from "./Loading";
import Panel from "./Panel";
import { useObrTheme } from "../hooks/useObrTheme";
import { useRole } from "../hooks/useRole";

// Any SDK call before Owlbear is ready throws ("Unable to send message: not
// ready"), so nothing below this gate runs until onReady.
const App = () => {
  const [ready, setReady] = useState(OBR.isReady);
  useEffect(() => {
    if (!ready) OBR.onReady(() => setReady(true));
  }, [ready]);
  return ready ? <Plugin /> : <Loading />;
};

const Plugin = () => {
  useObrTheme();
  const role = useRole();
  // Nothing role-specific renders until the role is known.
  return role ? <Panel role={role} /> : <Loading />;
};

export default App;
