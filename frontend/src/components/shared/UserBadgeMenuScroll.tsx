import React from 'react';

interface UserBadgeMenuScrollProps {
  children: React.ReactNode;
}

/**
 * Clips scroll to the popover border box. Uses padding + negative margin so the
 * native scrollbar thumb renders inside the menu on Windows/Chrome.
 */
export const UserBadgeMenuScroll: React.FC<UserBadgeMenuScrollProps> = ({ children }) => (
  <div className="user-badge-menu-clip">
    <div className="user-badge-menu-scroll">{children}</div>
  </div>
);
