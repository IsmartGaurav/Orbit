import React from 'react';
import { View, Pressable } from 'react-native';
import { useTheme } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Heading } from '../Global/Heading';
import { SmallText } from '../Global/SmallText';
import { PlainText } from '../Global/PlainText';
import { LoadingComponent } from '../Global/Loading';
import { EachSongCard } from '../Global/EachSongCard';
import { getValidImageUrl, safeString } from '../../Utils/ArtistUtils';
import FormatArtist from '../../Utils/FormatArtists';

/**
 * ArtistSongs component - displays artist songs with infinite scroll
 * @param {object} props - Component props
 * @param {Array} props.visibleSongs - Array of visible songs
 * @param {number} props.totalSongs - Total number of songs
 * @param {boolean} props.songLoading - Loading state for songs
 * @param {boolean} props.hasMoreSongs - Whether there are more songs to load
 * @param {function} props.onLoadMore - Function to load more songs
 * @returns {JSX.Element} - ArtistSongs component
 */
const ArtistSongs = ({ 
  visibleSongs, 
  totalSongs, 
  songLoading, 
  hasMoreSongs, 
  onLoadMore 
}) => {
  const theme = useTheme();

  if (!visibleSongs || visibleSongs.length === 0) {
    return (
      <View style={{ padding: 40, alignItems: 'center' }}>
        <Ionicons name="musical-notes-outline" size={48} color={theme.colors.text} style={{ opacity: 0.3, marginBottom: 16 }} />
        <PlainText text="No songs available" style={{ color: theme.colors.text, opacity: 0.6, fontSize: 16 }} />
      </View>
    );
  }

  return (
    <View style={{ paddingHorizontal: 10 }}>
      <View style={{ 
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: 15, 
        paddingHorizontal: 10 
      }}>
        <Heading text="Top Songs" style={{ color: theme.colors.text, fontSize: 20 }} />
        <SmallText
          text={safeString(totalSongs > 0 ? `${totalSongs} songs` : `${visibleSongs.length} songs`)}
          style={{ color: theme.colors.text, opacity: 0.6 }}
        />
      </View>
      
      <View>
        {visibleSongs.map((song, index) => {
          // Safety checks to prevent undefined values
          if (!song || !song.id) return <View key={index} />;

          return (
            <EachSongCard
              key={`${song.id}-${index}`}
              title={safeString(song.name, "Unknown Title")}
              artist={safeString(FormatArtist(song.artists?.primary), "Unknown Artist")}
              image={getValidImageUrl(song.image)}
              id={song.id}
              url={song.downloadUrl?.[2]?.url || song.downloadUrl?.[1]?.url || song.downloadUrl?.[0]?.url}
              duration={song.duration}
              language={song.language}
              artistID={song.artists?.primary?.[0]?.id}
              width="100%"
              isFromPlaylist={true}
              Data={{ data: { songs: visibleSongs } }}
              index={index}
              showNumber={true}
              truncateTitle={true}
              style={{
                marginBottom: 8,
                borderRadius: 12,
              }}
            />
          );
        })}

        {/* Load More Button */}
        {hasMoreSongs && (
          <Pressable
            onPress={onLoadMore}
            disabled={songLoading}
            style={{
              backgroundColor: theme.colors.card,
              paddingVertical: 12,
              paddingHorizontal: 20,
              borderRadius: 25,
              marginTop: 15,
              marginBottom: 10,
              marginHorizontal: 10,
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
              opacity: songLoading ? 0.6 : 1,
            }}
          >
            {songLoading ? (
              <LoadingComponent loading={true} height={20} />
            ) : (
              <>
                <Ionicons name="add-circle-outline" size={20} color={theme.colors.text} style={{ marginRight: 8 }} />
                <PlainText
                  text={safeString(`Load More (${(totalSongs || 0) - (visibleSongs.length || 0)} remaining)`)}
                  style={{ color: theme.colors.text, fontWeight: 'bold' }}
                />
              </>
            )}
          </Pressable>
        )}
      </View>
    </View>
  );
};

export default ArtistSongs;
