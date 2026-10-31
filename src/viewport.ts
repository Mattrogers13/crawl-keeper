import OBR from "@owlbear-rodeo/sdk";

// Moves the GM's camera so the token sits in the middle, at the current zoom.
// The viewport maps a map point p to the screen at p * scale + position
// (Owlbear's canvas transform; unverified in the SDK docs, checked in a room).
export const centerOn = async (id: string) => {
  const [bounds, scale, width, height] = await Promise.all([
    OBR.scene.items.getItemBounds([id]),
    OBR.viewport.getScale(),
    OBR.viewport.getWidth(),
    OBR.viewport.getHeight(),
  ]);
  await OBR.viewport.animateTo({
    scale,
    position: { x: width / 2 - bounds.center.x * scale, y: height / 2 - bounds.center.y * scale },
  });
};
