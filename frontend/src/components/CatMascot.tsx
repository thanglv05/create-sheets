import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { notifications } from '@mantine/notifications';
import { Tooltip } from '@mantine/core';

export default function CatMascot() {
  const [pupilPos, setPupilPos] = useState({ x: 0, y: 0 });
  const [isWaking, setIsWaking] = useState(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // Lấy vị trí trung tâm của con mèo ở góc màn hình
      const catX = window.innerWidth - 60;
      const catY = window.innerHeight - 60;
      
      const dx = e.clientX - catX;
      const dy = e.clientY - catY;
      
      const angle = Math.atan2(dy, dx);
      const maxDistance = 4;
      const distance = Math.min(Math.sqrt(dx*dx + dy*dy) / 60, maxDistance);
      
      setPupilPos({
        x: Math.cos(angle) * distance,
        y: Math.sin(angle) * distance,
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const pokeCat = () => {
    if (isWaking) return;
    setIsWaking(true);
    notifications.show({
      title: 'Meow! 🐾',
      message: 'Xin chào ông chủ! Chúc ông chủ một ngày auto vui vẻ!',
      color: 'grape',
    });
    setTimeout(() => setIsWaking(false), 2000);
  };

  return (
    <div style={{ position: 'fixed', bottom: 20, right: 30, zIndex: 9999, cursor: 'pointer' }} onClick={pokeCat}>
      <Tooltip label="Meow?" position="left" withArrow>
        <motion.div animate={isWaking ? { y: -15, scale: 1.1 } : { y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 300 }}>
          <svg width="80" height="80" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <g style={{ filter: 'drop-shadow(0px 4px 6px rgba(0,0,0,0.3))' }}>
              {/* Thân */}
              <path d="M20 100C20 60 40 45 50 45C60 45 80 60 80 100H20Z" fill="#1A1B1E" />
              {/* Đầu */}
              <circle cx="50" cy="50" r="30" fill="#1A1B1E" />
              {/* Tai */}
              <path d="M25 40L20 10L40 25Z" fill="#1A1B1E" />
              <path d="M75 40L80 10L60 25Z" fill="#1A1B1E" />
              {/* Trong tai */}
              <path d="M27 35L23 18L36 28Z" fill="#FFC9C9" />
              <path d="M73 35L77 18L64 28Z" fill="#FFC9C9" />
              
              {/* Tròng trắng */}
              <circle cx="37" cy="45" r="9" fill="#FFF" />
              <circle cx="63" cy="45" r="9" fill="#FFF" />
              
              {/* Con ngươi */}
              <circle cx={37 + pupilPos.x} cy={45 + pupilPos.y} r="4.5" fill="#000" />
              <circle cx={63 + pupilPos.x} cy={45 + pupilPos.y} r="4.5" fill="#000" />
              
              {/* Mũi */}
              <path d="M48 55L50 58L52 55Z" fill="#FFC9C9" />
              
              {/* Miệng */}
              <path d="M46 60Q50 65 54 60" stroke="#FFC9C9" strokeWidth="1.5" fill="none" strokeLinecap="round" />
              
              {/* Râu */}
              <line x1="8" y1="50" x2="22" y2="52" stroke="#444" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="8" y1="55" x2="22" y2="55" stroke="#444" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="92" y1="50" x2="78" y2="52" stroke="#444" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="92" y1="55" x2="78" y2="55" stroke="#444" strokeWidth="1.5" strokeLinecap="round" />
            </g>
          </svg>
        </motion.div>
      </Tooltip>
    </div>
  );
}
