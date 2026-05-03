import { ReactNode } from "react";
import "./Card.css";

interface CardProps {
  children: ReactNode;
  className?: string;
  animate?: boolean;
  delay?: string;
  style?: React.CSSProperties;
}

export default function Card({ 
  children, 
  className = "", 
  animate = false,
  delay = "0s",
  style = {}
}: CardProps) {
  const combinedStyle = animate 
    ? { ...style, animationDelay: delay }
    : style;

  return (
    <div 
      className={`glass card ${animate ? 'animate-fade-in' : ''} ${className}`}
      style={combinedStyle}
    >
      {children}
    </div>
  );
}
