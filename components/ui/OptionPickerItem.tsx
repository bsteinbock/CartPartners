import { useThemeColor } from '@/hooks/use-theme-color';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleProp, StyleSheet, TextStyle, ViewStyle } from 'react-native';
import { ThemedText } from '../themed-text';
import { ThemedTextInput } from '../themed-textinput';
import { ThemedView } from '../themed-view';

/* -------------------------------------------
 Standard Supporting React State 
 -------------------------------------------
  const [isListPickerVisible, setIsListPickerVisible] = useState<boolean>(false);
  const [pickedOption, setPickedOption] = useState<OptionEntry | undefined>(undefined);
  const [pickedOptionLabel, setPickedOptionLabel] = useState<string | undefined>(undefined);
  const onOptionSelected = (option: OptionEntry) => {
    setPickedOption(option);
    if (option) {
      setPickedOptionLabel(option.label);
    }
    setIsListPickerVisible(false);
  };

  const optionLabelChanged = useCallback((optionLabel: string) => {
    const match = pickerOptions.find((o) => o.label === optionLabel);
    setPickedOptionLabel(optionLabel);
    setPickedOption(match);
  }, []);
  -------------------------------------------------------
  Example OptionPickerItem JSX
  -------------------------------------------------------
    <OptionPickerItem
        optionLabel={pickedOptionLabel}
        label="My Option"
        placeholder="Define Option"
        onOptionLabelChange={optionLabelChanged}
        onPickerButtonPress={() => setIsListPickerVisible(true)}
    />
  -------------------------------------------------------
  Supporting Modal OptionList and BottomSheetContainer JSX
  -------------------------------------------------------
      {isListPickerVisible && (
        <BottomSheetContainer isVisible={isListPickerVisible} onClose={() => setIsListPickerVisible(false)}>
          <OptionList
            options={pickerOptions}
            onSelect={(option) => onOptionSelected(option)}
            selectedOption={pickedOption}
          />
        </BottomSheetContainer>
      )}
  ----------------------------------------------*/

interface OptionPickerItemProps {
  optionLabel?: string;
  onOptionLabelChange?: (label: string) => void;
  onPickerButtonPress: () => void;
  label?: string;
  placeholder?: string;
  editable?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
}

export const OptionPickerItem: React.FC<OptionPickerItemProps> = ({
  optionLabel,
  onOptionLabelChange,
  onPickerButtonPress,
  label,
  placeholder,
  editable = false,
  containerStyle,
  inputStyle,
}) => {
  const iconColor = useThemeColor({ light: undefined, dark: undefined }, 'icon');
  const textDim = useThemeColor({ light: undefined, dark: undefined }, 'textDim');

  if (!editable) {
    return (
      <Pressable onPress={onPickerButtonPress}>
        <ThemedView style={[styles.optionPickerRow, containerStyle]}>
          <ThemedView style={{ flex: 1 }}>
            {label && <ThemedText>{label}</ThemedText>}
            <ThemedTextInput
              style={inputStyle}
              placeholder={placeholder}
              placeholderTextColor={textDim}
              onChangeText={onOptionLabelChange}
              value={optionLabel}
              editable={editable}
            />
          </ThemedView>
          <ThemedView style={[styles.pickerButtonContainer, { justifyContent: 'flex-end' }]}>
            <Ionicons name="ellipsis-horizontal-circle" size={36} color={iconColor} />
          </ThemedView>
        </ThemedView>
      </Pressable>
    );
  }

  return (
    <ThemedView style={[styles.optionPickerRow, containerStyle]}>
      <ThemedView style={{ flex: 1 }}>
        {label && <ThemedText>{label}</ThemedText>}
        <ThemedTextInput
          style={inputStyle}
          placeholder={placeholder}
          placeholderTextColor={textDim}
          onChangeText={onOptionLabelChange}
          value={optionLabel}
          editable={editable}
        />
      </ThemedView>
      <Pressable onPress={onPickerButtonPress} style={{ justifyContent: 'flex-end' }}>
        <ThemedView style={styles.pickerButtonContainer}>
          <Ionicons name="ellipsis-horizontal-circle" size={36} color={iconColor} />
        </ThemedView>
      </Pressable>
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  optionPickerRow: {
    width: '100%',
    flexDirection: 'row',
  },
  pickerButtonContainer: {
    paddingLeft: 10,
  },
});
