import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import BottomSheetContainer from '@/components/ui/BottomSheetContainer';
import OptionList, { OptionEntry } from '@/components/ui/OptionList';
import { OptionPickerItem } from '@/components/ui/OptionPickerItem';
import SwipeableRound from '@/components/ui/SwipeableRound';
import { useDbStore } from '@/hooks/use-dbStore';
import { useThemeColor } from '@/hooks/use-theme-color';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { useFocusEffect, useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { FlatList, Pressable } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function RoundsScreen() {
  const router = useRouter();
  const { rounds, leagues, setCurrentLeagueId, currentLeagueId } = useDbStore();
  const iconColor = useThemeColor({ light: undefined, dark: undefined }, 'iconButton');
  const borderColor = useThemeColor({ light: undefined, dark: undefined }, 'border');

  const [isLeaguePickerVisible, setIsLeaguePickerVisible] = useState<boolean>(false);
  const [leagueOptions, setLeagueOptions] = useState<OptionEntry[]>([]);
  const [pickedOption, setPickedOption] = useState<OptionEntry | undefined>(undefined);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      (async () => {
        const storedHidePastRounds = await SecureStore.getItemAsync('cartPartnerHidePastRounds');
        if (isActive) {
          useDbStore.getState().setOnlyUpcomingDates(storedHidePastRounds === 'true');
        }
      })();

      return () => {
        isActive = false;
      };
    }, []),
  );

  useEffect(() => {
    const availableOptions = leagues.map((r) => ({
      label: r.name,
      value: r.id,
    }));
    if (availableOptions.length === 0) {
      setLeagueOptions([]);
    } else {
      setLeagueOptions(availableOptions);
    }
  }, [leagues]);

  useEffect(() => {
    if (currentLeagueId && leagueOptions.length > 0) {
      const found = leagueOptions.find((o) => o.value === currentLeagueId);
      setPickedOption(found);
    } else {
      setPickedOption(undefined);
    }
  }, [currentLeagueId, leagueOptions]);

  const createAndOpen = async () => {
    router.push({ pathname: '/edit-or-add', params: { id: 'new' } });
  };

  const handleImportCSV = () => {
    router.push('/import-csv-rounds' as any);
  };

  const handleLeagueOptionChange = (option: OptionEntry) => {
    const leagueToSetActive = leagues.find((p) => p.id === option.value);
    if (leagueToSetActive) {
      setCurrentLeagueId(leagueToSetActive.id);
      setIsLeaguePickerVisible(false);
    }
  };

  return (
    <>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ThemedView style={{ flex: 1 }}>
          <ThemedView
            style={{
              paddingHorizontal: 12,
              paddingBottom: 12,
              marginTop: 4,
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: borderColor,
            }}
          >
            <OptionPickerItem
              optionLabel={pickedOption ? pickedOption.label : 'Unknown League'}
              placeholder="Select League / Outing"
              onPickerButtonPress={() => setIsLeaguePickerVisible(true)}
            />
          </ThemedView>

          <View
            style={{
              marginTop: 8,
              paddingHorizontal: 12,
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <ThemedText type="title">Rounds</ThemedText>
            <View style={{ flexDirection: 'row', gap: 20, alignItems: 'center' }}>
              <Pressable onPress={handleImportCSV}>
                <MaterialCommunityIcons name="application-import" size={28} color={iconColor} />
              </Pressable>
              <Pressable onPress={createAndOpen}>
                <FontAwesome5 name="plus-circle" size={28} color={iconColor} />
              </Pressable>
            </View>
          </View>
          <>
            {rounds.length === 0 && (
              <ThemedView style={{ flex: 1, padding: 12, marginTop: 30, alignItems: 'center' }}>
                <ThemedText type="title">Welcome</ThemedText>
                <ThemedText style={{ marginTop: 12 }}>
                  CartPartners is designed to maximize your interaction with the rest of your golfing buddies.
                  It does this by ensuring your cart partners are different from round to round.
                </ThemedText>
                <ThemedText style={{ marginTop: 12 }}>
                  To get started just add a round using the blue + icon in the top right. Once that is done,
                  select the round and define the lineup of players for the round. Finally use the Group tab
                  at the bottom to be taken to a screen that generates your Tee Groups and then allows you to
                  notify them via email. For more info see the About tab.
                </ThemedText>
              </ThemedView>
            )}
            {rounds.length > 0 && (
              <>
                <ThemedView style={{ height: 1, backgroundColor: borderColor }} />
                <FlatList
                  data={rounds}
                  keyExtractor={(item) => String(item.id)}
                  renderItem={({ item }) => <SwipeableRound round={item} />}
                />
              </>
            )}
          </>
        </ThemedView>
      </SafeAreaView>
      {leagueOptions && isLeaguePickerVisible && (
        <BottomSheetContainer
          isVisible={isLeaguePickerVisible}
          title="Select League / Outing"
          modalHeight="50%"
          onClose={() => setIsLeaguePickerVisible(false)}
        >
          <OptionList
            options={leagueOptions}
            selectedOption={pickedOption}
            onSelect={(option) => handleLeagueOptionChange(option)}
          />
        </BottomSheetContainer>
      )}
    </>
  );
}
