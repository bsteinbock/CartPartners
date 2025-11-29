import { useThemeColor } from '@/hooks/use-theme-color';
import { useEffect, useState } from 'react';
import { FlatList, Platform, Pressable, StyleProp, StyleSheet, TextStyle } from 'react-native';
import { ThemedText } from '../themed-text';
import { ThemedView } from '../themed-view';
import ThemedButton from './ThemedButton';

// Define types for the props
export interface OptionEntry {
  label: string;
  value?: any;
}

type Props = {
  options: OptionEntry[];
  onSelect: (option: OptionEntry) => void;
  textStyle?: StyleProp<TextStyle>;
  showOkCancel?: boolean;
  onCancel?: () => void;
  selectedOption?: OptionEntry;
  centerOptions?: boolean;
  boldSelectedOption?: boolean;
};

export default function OptionList({
  options,
  onSelect,
  textStyle,
  showOkCancel,
  onCancel,
  selectedOption,
  centerOptions = true,
  boldSelectedOption = true,
}: Props) {
  const [pickedOption, setPickedOption] = useState<OptionEntry | undefined>(undefined);

  const onOkSelected = () => {
    if (pickedOption) onSelect(pickedOption);
  };

  const onOptionSelected = (item: OptionEntry) => {
    setPickedOption(item);
    if (showOkCancel) {
      // When OK/Cancel buttons are shown, wait for OK press
    } else {
      onSelect(item);
    }
  };

  useEffect(() => {
    if (options && selectedOption) {
      const match = options.find((o) => o.label === selectedOption.label);
      if (match) {
        setPickedOption(match);
      }
    }
  }, [selectedOption, options]);

  const borderColor = useThemeColor({ light: undefined, dark: undefined }, 'border');

  return (
    <ThemedView style={{ flex: 1 }}>
      <ThemedView style={{ flex: 1 }}>
        <FlatList
          showsVerticalScrollIndicator={Platform.OS === 'web'}
          data={options}
          renderItem={({ item, index }) => (
            <ThemedView>
              <Pressable
                key={index}
                style={[
                  {
                    width: '100%',
                    paddingHorizontal: 10,
                    borderBottomWidth: 1,
                    borderBottomColor: borderColor,
                    justifyContent: 'center',
                    height: 45,
                  },
                  centerOptions && { alignItems: 'center' },
                ]}
                onPress={() => {
                  onOptionSelected(item);
                }}
              >
                <ThemedText
                  style={[
                    { fontWeight: 500 },
                    textStyle,
                    pickedOption &&
                      boldSelectedOption &&
                      item.label === pickedOption.label && { fontSize: 18, fontWeight: 800 },
                  ]}
                >
                  {item.label}
                </ThemedText>
              </Pressable>
            </ThemedView>
          )}
        />
      </ThemedView>
      {showOkCancel && (
        <ThemedView style={{ borderTopColor: borderColor }}>
          <ThemedView style={[styles.saveButtonRow, { borderTopColor: borderColor }]}>
            <ThemedButton title="Save" onPress={onOkSelected} />
            <ThemedButton onPress={() => onCancel && onCancel()} title="Cancel" />
          </ThemedView>
        </ThemedView>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  listContainer: {
    borderTopRightRadius: 10,
    borderTopLeftRadius: 10,
    paddingHorizontal: 20,
    alignItems: 'center',
    width: '100%',
    borderBottomWidth: 1,
    borderColor: 'white',
  },
  saveButtonRow: {
    paddingHorizontal: 10,
    borderTopWidth: 2,
    marginTop: 10,
    paddingTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  saveButton: {
    flex: 1,
    marginRight: 5,
  },
  cancelButton: {
    flex: 1,
    marginLeft: 5,
  },
});
