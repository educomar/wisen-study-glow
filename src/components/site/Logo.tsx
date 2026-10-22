const darkLogo = { url: "/images/wisen-logo-dark.png" };
const lightLogo = { url: "/images/wisen-logo-light.png" };

export function Logo({ className = "h-10 w-auto sm:h-11" }: { className?: string }) {
  return (
    <span className="inline-flex items-center">
      <img src={lightLogo.url} alt="Wisen" className={`${className} dark:hidden`} />
      <img src={darkLogo.url} alt="Wisen" className={`${className} hidden dark:block`} />
    </span>
  );
}
