import { useThemeColor } from '@/hooks/use-theme-color';
import { FlatList, Platform, Pressable, StyleProp, TextStyle } from 'react-native';
import { ThemedText } from '../themed-text';
import { ThemedView } from '../themed-view';

// Define types for the props
export interface OptionEntry {
  label: string;
  value?: any;
}

type Props = {
  options: OptionEntry[];
  onSelect: (option: OptionEntry) => void;
  textStyle?: StyleProp<TextStyle>;
  selectedOptions?: OptionEntry[];
  centerOptions?: boolean;
  boldSelectedOption?: boolean;
};

export default function MultiSelectOptionList({
  options,
  onSelect,
  textStyle,
  selectedOptions,
  centerOptions = true,
  boldSelectedOption = true,
}: Props) {
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
                onPress={() => onSelect(item)}
              >
                <ThemedText
                  style={[
                    { fontWeight: 500 },
                    textStyle,
                    selectedOptions?.find((o) => o.label === item.label) &&
                      boldSelectedOption && { fontSize: 18, fontWeight: 800, color: 'green' },
                  ]}
                >
                  {item.label}
                </ThemedText>
              </Pressable>
            </ThemedView>
          )}
        />
      </ThemedView>
    </ThemedView>
  );
}
