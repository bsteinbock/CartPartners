import { useThemeColor } from '@/hooks/use-theme-color';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { PropsWithChildren } from 'react';
import { DimensionValue, Modal, Pressable, StyleSheet, TouchableWithoutFeedback } from 'react-native';
import { ThemedText } from '../themed-text';
import { ThemedView } from '../themed-view';

type Props = PropsWithChildren<{
  isVisible: boolean;
  onClose: () => void;
  onOK?: () => void;
  title?: string;
  okLabel?: string;
  modalHeight?: DimensionValue;
  okDisabled?: boolean;
}>;

export default function BottomSheetContainer({
  isVisible,
  children,
  onClose,
  onOK,
  title,
  okLabel = 'OK',
  modalHeight = '40%',
  okDisabled = false,
}: Props) {
  const background = useThemeColor({ light: undefined, dark: undefined }, 'background');
  const backgroundWithAlpha = useThemeColor({ light: undefined, dark: undefined }, 'backgroundWithAlpha');
  const borderColor = useThemeColor({ light: undefined, dark: undefined }, 'border');
  const iconColor = useThemeColor({ light: undefined, dark: undefined }, 'icon');
  const iconButtonColor = useThemeColor({ light: undefined, dark: undefined }, 'iconButton');
  const buttonDisabledColor = useThemeColor({ light: undefined, dark: undefined }, 'disabledColor');

  if (!isVisible) return null;

  return (
    <Modal animationType="slide" transparent={true} visible={isVisible} onRequestClose={() => onClose()}>
      <TouchableWithoutFeedback onPress={() => onClose()}>
        <ThemedView style={{ flex: 1, backgroundColor: 'transparent' }}>
          <ThemedView
            style={{
              flex: 1,
              backgroundColor: backgroundWithAlpha,
            }}
          >
            <ThemedView style={[styles.modalContent, { bottom: 0, height: modalHeight }]}>
              {title ? (
                <ThemedView
                  style={[
                    styles.titleContainer,
                    {
                      backgroundColor: background,
                      borderBottomWidth: 2,
                      borderColor: borderColor,
                    },
                  ]}
                >
                  <ThemedText style={[{ fontWeight: '600' }]}>{title}</ThemedText>
                  <ThemedView
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 20,
                    }}
                  >
                    {onOK && (
                      <Pressable onPress={() => onOK()} disabled={okDisabled}>
                        <ThemedText
                          style={{
                            color: okDisabled ? buttonDisabledColor : iconButtonColor,
                            fontWeight: '600',
                          }}
                        >
                          {okLabel}
                        </ThemedText>
                      </Pressable>
                    )}
                    <Pressable onPress={() => onClose()}>
                      <MaterialIcons name="close" color={iconColor} size={28} />
                    </Pressable>
                  </ThemedView>
                </ThemedView>
              ) : (
                <ThemedView style={{ height: 10 }} />
              )}
              {children}
            </ThemedView>
          </ThemedView>
        </ThemedView>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContent: {
    width: '100%',
    borderTopRightRadius: 18,
    borderTopLeftRadius: 18,
    position: 'absolute',
  },
  titleContainer: {
    minHeight: 50,
    borderTopRightRadius: 10,
    borderTopLeftRadius: 10,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
