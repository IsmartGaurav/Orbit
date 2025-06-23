import React, { useState, useEffect } from 'react';
import { Dimensions, FlatList, View } from 'react-native';
import { EachSongCard } from '../Global/EachSongCard';
import { LoadingComponent } from '../Global/Loading';
import { PlainText } from '../Global/PlainText';
import { SmallText } from '../Global/SmallText';
import { preloadTopTidalSongs } from '../../Utils/TidalMusicHandler';
import { useTheme } from '@react-navigation/native';

export default function SongDisplay({ data, source = 'saavn' }) {
  const [displayData, setDisplayData] = useState(data);
  const theme = useTheme();

  useEffect(() => {
    setDisplayData(data);

    // Preload the top 3 Tidal songs from the search results.
    if (source === 'tidal' && data?.data?.results?.length > 0) {
      console.log('Preloading top 3 Tidal songs from search results.');
      preloadTopTidalSongs(data.data.results.slice(0, 3));
    }
  }, [data, source]);

  const width = Dimensions.get('window').width;

  function FormatArtist(artists) {
    if (!artists || !Array.isArray(artists)) return '';
    return artists.map(e => e.name).join(', ');
  }

  if (!displayData?.data?.results || displayData.data.results.length === 0) {
    return (
      <View style={{ height: 400, alignItems: 'center', justifyContent: 'center' }}>
        <PlainText
          text={'No Songs Found!'}
          style={{
            color: theme.dark ? '#CCCCCC' : '#666666',
            fontSize: 18,
            fontWeight: '600'
          }}
        />
        <SmallText
          text={'Try searching for something else. T_T'}
          style={{
            color: theme.dark ? '#999999' : '#888888',
            marginTop: 8
          }}
        />
      </View>
    );
  }

  return (
    <View>
      <FlatList
        showsVerticalScrollIndicator={false}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{ paddingBottom: 220 }}
        data={displayData.data.results}
        renderItem={({ item }) => {
          if (!item || !item.id) return null; // Render nothing if item is invalid
          return (
            <EachSongCard
              artistID={item?.primaryArtistsId || item?.primary_artists_id}
              language={item?.language}
              duration={item?.duration}
              image={item?.image?.[2]?.url ?? item?.image?.[0]?.url ?? ''}
              id={item?.id}
              width={width * 0.95}
              title={item?.name || item?.title}
              artist={source === 'tidal' ? item?.artist : FormatArtist(item?.artists?.primary)}
              url={item?.downloadUrl} // This is used for Saavn downloads
              showNumber={false}
              source={'search'} // Mark as from search for special queue logic
              tidalUrl={item?.url} // Correctly pass the tidal track URL
              Data={displayData}
              index={displayData.data.results.findIndex(x => x.id === item.id)}
            />
          );
        }}
      />
    </View>
  );
}
