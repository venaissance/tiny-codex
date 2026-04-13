/**
 * Streamdown Tailwind Safelist
 *
 * This component is NEVER rendered — it exists solely so the Tailwind v4 oxide scanner
 * detects ALL utility classes that Streamdown uses internally. Without this, the Vite
 * dev server generates 0 Tailwind utilities because:
 *  1. Our React components use custom CSS classes, not Tailwind utilities
 *  2. Streamdown is in node_modules, which is excluded from Tailwind's content scanning
 *
 * Extracted from: node_modules/streamdown/dist/chunk-BO2N2NFS.js
 * Keep in sync when upgrading streamdown.
 */
export default function StreamdownSafelist() {
  return (
    <>
      {/* Layout & positioning */}
      <div className="absolute relative fixed sticky hidden block inline-block inline-flex group flex flex-1 flex-col shrink-0 origin-center pointer-events-none pointer-events-auto" />
      {/* Sizing */}
      <div className="w-4 w-8 w-full h-4 h-8 h-full size-4 size-full min-h-28 max-h-32 max-w-full max-w-md" />
      {/* Spacing */}
      <div className="p-1 p-1.5 p-2 p-3 p-4 p-6 px-1.5 px-3 px-4 py-0.5 py-1 py-2 pl-4 pt-0" />
      <div className="m-0 ml-1 mt-1 mt-2 mt-6 mb-2 mx-4 my-4 my-6 -mt-10" />
      <div className="gap-1 gap-2 gap-4 space-x-2 space-y-4" />
      {/* Flexbox */}
      <div className="items-center justify-center justify-end" />
      {/* Overflow */}
      <div className="overflow-auto overflow-hidden overflow-x-auto overflow-y-auto" />
      {/* Borders & dividers */}
      <div className="rounded rounded-full rounded-lg rounded-md rounded-xl" />
      <div className="border border-b-2 border-l-4 border-border border-collapse border-current border-sidebar border-muted-foreground" />
      <div className="divide-y divide-border" />
      {/* Backgrounds */}
      <div className="bg-background bg-muted bg-primary bg-sidebar bg-red-50 bg-red-100" />
      <div className="bg-background/50 bg-background/80 bg-background/90 bg-background/95" />
      <div className="bg-black/10 bg-muted/80 bg-sidebar/80 bg-sidebar/70" />
      {/* Text */}
      <div className="text-xs text-sm text-base text-lg text-xl text-2xl text-3xl" />
      <div className="text-left text-right text-foreground text-muted-foreground text-primary text-primary-foreground" />
      <div className="text-red-600 text-red-700 text-red-800" />
      {/* Font & text styling */}
      <div className="font-medium font-mono font-semibold italic lowercase underline line-through" />
      <div className="break-all whitespace-normal whitespace-nowrap wrap-anywhere tracking-tight" />
      {/* Lists */}
      <div className="list-decimal list-disc list-inside" />
      {/* Interactive */}
      <div className="cursor-pointer opacity-0 transition transition-all transition-colors transition-transform" />
      <div className="duration-150 duration-200 ease-out animate-spin appearance-none" />
      <div className="backdrop-blur-sm shadow-sm shadow-lg" />
      {/* Positioning */}
      <div className="inset-0 top-2 top-4 top-full right-0 right-2 right-4 bottom-2 bottom-4 left-2 left-4 z-10 z-20 z-50" />
      {/* Opacity variants */}
      <div className="border-muted-foreground/30 text-muted-foreground/50" />
      {/* Hover states */}
      <div className="hover:bg-background hover:bg-muted hover:bg-muted/40 hover:bg-primary/90 hover:text-foreground" />
      {/* Group & disabled */}
      <div className="group-hover:block group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-50" />
      {/* Before pseudo */}
      <div className="before:inline-block before:mr-4 before:w-6 before:font-mono before:text-right before:text-muted-foreground/50" />
    </>
  );
}
