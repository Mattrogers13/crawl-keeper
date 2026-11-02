import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import Homepage from "./Homepage";

describe("Homepage (the how-to guide)", () => {
  it("shows the install link, the guide and the Crawling Clock rules", () => {
    render(<Homepage />);
    expect(screen.getByText(`${window.location.origin}/manifest.json`)).toBeInTheDocument();
    for (const title of ["Install", "Set up a scene (GM)", "Running turns", "Crawling", "Lights and darkness", "Combat", "What players see", "The Crawling Clock"])
      expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
    expect(screen.getByText(/starts at 20 when the party enters a dangerous place/)).toBeInTheDocument();
  });
});
