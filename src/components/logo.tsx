import Image from "next/image";

// The ink logo on light grounds and the light logo on dark grounds (brand book).
export function Logo({ height = 22, mark = false }: { height?: number; mark?: boolean }) {
  if (mark) {
    return (
      <>
        <Image className="logo-ink" src="/brand/menab-mark-ink.png" alt="Menab" width={height} height={height} style={{ height, width: "auto" }} />
        <Image className="logo-light" src="/brand/menab-mark-light.png" alt="Menab" width={height} height={height} style={{ height, width: "auto" }} />
      </>
    );
  }
  const width = Math.round(height * 5.545);
  return (
    <>
      <Image className="logo-ink" src="/brand/menab-logo-ink.png" alt="Menab" width={width} height={height} priority style={{ height, width: "auto" }} />
      <Image className="logo-light" src="/brand/menab-logo-light.png" alt="Menab" width={width} height={height} priority style={{ height, width: "auto" }} />
    </>
  );
}
