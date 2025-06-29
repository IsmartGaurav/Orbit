import React from "react";
import { Dimensions } from "react-native";
import FastImage from "react-native-fast-image";
import { GestureManager } from './GestureControls';

export const AlbumArtworkDisplay = ({
  currentPlaying,
  artworkSource,
  onClose,
  style
}) => {
  const width = Dimensions.get("window").width;

  return (
    <GestureManager
      onClose={onClose}
      style={{ alignItems: 'center', ...style }}
    >
      <FastImage
        source={artworkSource}
        style={{
          height: width * 0.9,
          width: width * 0.9,
          borderRadius: 10
        }}
        resizeMode={FastImage.resizeMode.contain}
        key={`artwork-${JSON.stringify(artworkSource)}`}
      />
    </GestureManager>
  );
};
