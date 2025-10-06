declare module 'react-native-draggable-flatlist' {
  import { ComponentType } from 'react';
    import { FlatListProps } from 'react-native';
  type RenderItemParams<ItemT> = { item: ItemT; index: number; drag: () => void; isActive: boolean };
  type DraggableFlatListProps<ItemT> = Omit<FlatListProps<ItemT>, 'renderItem' | 'data'> & {
    data: ItemT[];
    renderItem: (params: RenderItemParams<ItemT>) => JSX.Element;
    onDragEnd?: (params: { data: ItemT[] }) => void;
  };
  const DraggableFlatList: ComponentType<DraggableFlatListProps<any>>;
  export default DraggableFlatList;
}
