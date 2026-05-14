import logoSrc from "../../assets/icon.png";
import appConfig from "../../config/app";

interface AppLogoProps {
  iconSize?: number;
  showName?: boolean;
  nameClass?: string;
  className?: string;
}

export default function AppLogo({ iconSize = 20, showName = false, nameClass = "", className = "" }: AppLogoProps) {
  return (
    <>
      <img src={logoSrc} alt={appConfig.name} width={iconSize} height={iconSize} style={{ objectFit: "contain" }} className={className} />
      {showName && <span className={nameClass}>{appConfig.name}</span>}
    </>
  );
}
