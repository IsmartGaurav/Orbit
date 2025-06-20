import React, { useEffect } from 'react';
import { BackHandler } from 'react-native';
import { useNavigationHandler } from './useNavigationHandler';

/**
 * BackButtonHandler - Handles hardware back button for music player navigation
 * 
 * This component provides back button handling including:
 * - Hardware back button interception
 * - Custom back navigation logic
 * - Player minimization on back press
 * - Navigation state restoration
 */

export const BackButtonHandler = ({ 
  children,
  Index,
  setIndex,
  musicPreviousScreen,
  enabled = true,
  onBackPress = null
}) => {
  const { handleBackNavigation } = useNavigationHandler({
    musicPreviousScreen,
    onNavigationChange: (path, params) => {
      console.log('BackButtonHandler: Navigation changed to:', path, params);
    }
  });

  useEffect(() => {
    if (!enabled) return;

    const backAction = () => {
      // Custom back press handler
      if (onBackPress) {
        const handled = onBackPress();
        if (handled) return true;
      }

      if (Index === 1) {
        console.log('BackButtonHandler: Back pressed in fullscreen mode, minimizing player');
        
        // Minimize the player
        setIndex(0);
        
        // Handle navigation after minimizing
        const handleNavigation = async () => {
          try {
            await handleBackNavigation();
          } catch (error) {
            console.error('BackButtonHandler: Error in navigation handling:', error);
          }
        };
        
        handleNavigation();
        return true; // Prevent default back action
      }
      
      return false; // Let default back action happen otherwise
    };

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction
    );

    return () => backHandler.remove();
  }, [Index, setIndex, enabled, onBackPress, handleBackNavigation]);

  return <>{children}</>;
};
