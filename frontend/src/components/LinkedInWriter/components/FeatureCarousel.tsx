import React, { useState } from 'react';

interface FeatureCard {
  title: string;
  desc: string;
  icon: string;
  image?: string;
  onClick?: () => void;
}

interface FeatureCarouselProps {
  onFactCheckClick: () => void;
  onCopilotClick: () => void;
}

export const FeatureCarousel: React.FC<FeatureCarouselProps> = ({
  onFactCheckClick,
  onCopilotClick
}) => {
  const [currentCardIndex, setCurrentCardIndex] = useState(0);

  const featureCards: FeatureCard[] = [
    {
      title: 'Check Facts',
      desc: 'Select text and verify claims with web-backed evidence.',
      icon: '🔍',
      image: '/alwrity-fact-check.png',
      onClick: onFactCheckClick
    },
    {
      title: 'Google-Grounded Search',
      desc: 'Use native Google grounding to inform content with current sources.',
      icon: '🌐'
    },
    {
      title: 'Persona-Aware Writing',
      desc: 'Generate content tailored to your writing persona and audience.',
      icon: '👤'
    },
    {
      title: 'Assistive Writing',
      desc: 'Inline, contextual suggestions as you type with citations.',
      icon: '✍️',
      image: '/alwrity-assistive-writing.png'
    },
    {
      title: 'ALwrity Copilot',
      desc: 'Advanced AI assistant for comprehensive content creation and editing.',
      icon: '🤖',
      image: '/alwrity-copilot1.png',
      onClick: onCopilotClick
    },
    {
      title: 'Multimodal Generation',
      desc: 'Create content with images, videos, and interactive elements.',
      icon: '🎨'
    }
  ];

  const nextCard = () => {
    setCurrentCardIndex((prev) => {
      const maxIndex = Math.max(0, featureCards.length - 3);
      return prev >= maxIndex ? 0 : prev + 3;
    });
  };

  const prevCard = () => {
    setCurrentCardIndex((prev) => {
      const maxIndex = Math.max(0, featureCards.length - 3);
      return prev <= 0 ? maxIndex : prev - 3;
    });
  };

  return (
    <div style={{
      marginBottom: 20,
      width: '100%',
      maxWidth: 1200,
      position: 'relative',
      padding: '10px 0'
    }}>
      {/* Carousel Container with Enhanced Styling */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.2)',
        borderRadius: '20px',
        padding: '12px',
        boxShadow: `
          0 20px 60px rgba(0,0,0,0.15),
          0 8px 32px rgba(102, 126, 234, 0.1),
          inset 0 1px 0 rgba(255,255,255,0.2)
        `,
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Background Glow Effect */}
        <div style={{
          position: 'absolute',
          top: '-50%',
          left: '-50%',
          width: '200%',
          height: '200%',
          background: 'radial-gradient(circle, rgba(102, 126, 234, 0.1) 0%, transparent 70%)',
          animation: 'rotate 20s linear infinite',
          zIndex: 0
        }} />

        {/* Compact Navigation - Positioned on the sides */}
        <button
          onClick={prevCard}
          style={{
            position: 'absolute',
            left: '8px',
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            border: 'none',
            borderRadius: '50%',
            width: 32,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4), 0 2px 8px rgba(0,0,0,0.1)',
            transition: 'all 0.3s ease',
            color: 'white',
            fontSize: '14px',
            fontWeight: 'bold',
            zIndex: 3
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-50%) scale(1.1)';
            e.currentTarget.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.6), 0 3px 12px rgba(0,0,0,0.15)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(-50%) scale(1)';
            e.currentTarget.style.boxShadow = '0 4px 15px rgba(102, 126, 234, 0.4), 0 2px 8px rgba(0,0,0,0.1)';
          }}
        >
          ‹
        </button>

        <button
          onClick={nextCard}
          style={{
            position: 'absolute',
            right: '8px',
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            border: 'none',
            borderRadius: '50%',
            width: 32,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4), 0 2px 8px rgba(0,0,0,0.1)',
            transition: 'all 0.3s ease',
            color: 'white',
            fontSize: '14px',
            fontWeight: 'bold',
            zIndex: 3
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-50%) scale(1.1)';
            e.currentTarget.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.6), 0 3px 12px rgba(0,0,0,0.15)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(-50%) scale(1)';
            e.currentTarget.style.boxShadow = '0 4px 15px rgba(102, 126, 234, 0.4), 0 2px 8px rgba(0,0,0,0.1)';
          }}
        >
          ›
        </button>

        {/* Features Grid - 3 at a time */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '12px',
          zIndex: 2,
          position: 'relative'
        }}>
          {featureCards.slice(currentCardIndex, currentCardIndex + 3).map((card, index) => (
            <div
              key={currentCardIndex + index}
              onClick={card.onClick}
              title={card.desc}
              style={{
                background: 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.05) 100%)',
                backdropFilter: 'blur(15px)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '16px',
                padding: '16px',
                boxShadow: `
                  0 12px 40px rgba(0,0,0,0.1),
                  0 4px 20px rgba(102, 126, 234, 0.1),
                  inset 0 1px 0 rgba(255,255,255,0.3)
                `,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                position: 'relative',
                overflow: 'hidden',
                transition: 'all 0.3s ease',
                minHeight: '140px',
                cursor: card.onClick ? 'pointer' : 'default'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-8px) scale(1.02)';
                e.currentTarget.style.boxShadow = `
                  0 20px 60px rgba(0,0,0,0.15),
                  0 8px 30px rgba(102, 126, 234, 0.2),
                  inset 0 1px 0 rgba(255,255,255,0.4)
                `;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0) scale(1)';
                e.currentTarget.style.boxShadow = `
                  0 12px 40px rgba(0,0,0,0.1),
                  0 4px 20px rgba(102, 126, 234, 0.1),
                  inset 0 1px 0 rgba(255,255,255,0.3)
                `;
              }}
            >
              {/* Card Background Pattern */}
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: `linear-gradient(45deg, 
                  rgba(102, 126, 234, ${0.1 + index * 0.05}) 0%, 
                  rgba(118, 75, 162, ${0.1 + index * 0.05}) 100%)`,
                opacity: 0.4
              }} />
              
              {/* Icon/Image - Much Larger */}
              <div style={{
                fontSize: '48px',
                marginBottom: '8px',
                zIndex: 1,
                filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.1))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%',
                height: '100px',
                flex: '1'
              }}>
                {card.image ? (
                  <img 
                    src={card.image} 
                    alt={card.title}
                    style={{
                      width: '95%',
                      height: '100%',
                      objectFit: 'contain',
                      borderRadius: '8px'
                    }}
                  />
                ) : (
                  <div style={{ fontSize: '64px' }}>
                    {card.icon}
                  </div>
                )}
              </div>
              
              {/* Title Only - Description moved to tooltip */}
              <h4 style={{
                margin: '0',
                color: '#1a202c',
                fontSize: '14px',
                fontWeight: '700',
                zIndex: 1,
                textShadow: '0 2px 4px rgba(0,0,0,0.1)',
                textAlign: 'center',
                lineHeight: '1.2',
                padding: '0 4px'
              }}>
                {card.title}
              </h4>
            </div>
          ))}
        </div>

        {/* Enhanced Dots Indicator */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '10px',
          marginTop: '12px',
          zIndex: 2,
          position: 'relative'
        }}>
          {Array.from({ length: Math.ceil(featureCards.length / 3) }).map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentCardIndex(index * 3)}
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                border: 'none',
                background: Math.floor(currentCardIndex / 3) === index 
                  ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' 
                  : 'rgba(255,255,255,0.3)',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                boxShadow: Math.floor(currentCardIndex / 3) === index 
                  ? '0 3px 12px rgba(102, 126, 234, 0.4)' 
                  : '0 2px 6px rgba(0,0,0,0.1)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.2)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.5)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = Math.floor(currentCardIndex / 3) === index 
                  ? '0 3px 12px rgba(102, 126, 234, 0.4)' 
                  : '0 2px 6px rgba(0,0,0,0.1)';
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
