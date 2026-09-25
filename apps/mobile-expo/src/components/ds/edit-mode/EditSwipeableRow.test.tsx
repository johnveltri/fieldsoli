import React from 'react';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { TextInput, View } from 'react-native';

jest.mock('react-native-gesture-handler', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    Swipeable: React.forwardRef(function SwipeableMock(
      { children, ...props }: { children?: React.ReactNode },
      _ref: unknown,
    ) {
      return (
        <View testID="swipeable" {...props}>
          {children}
        </View>
      );
    }),
  };
});

import { EditSwipeableRow } from './EditSwipeableRow';
import { createTextStyles } from '../../../theme/nativeTokens';

const typography = createTextStyles({
  serifBold: 'System',
  sans: 'System',
  sansSemi: 'System',
  sansBold: 'System',
});

describe('EditSwipeableRow', () => {
  it('keeps children mounted while swipe-to-delete is disabled during focus', () => {
    const onMount = jest.fn();
    const onUnmount = jest.fn();
    function Child() {
      React.useEffect(() => {
        onMount();
        return onUnmount;
      }, []);
      return <TextInput accessibilityLabel="Customer" />;
    }

    const props = {
      typography,
      accessibilityLabel: 'Customer',
      onDelete: jest.fn(),
    };
    const view = render(
      <EditSwipeableRow {...props} enabled>
        <Child />
      </EditSwipeableRow>,
    );
    expect(onMount).toHaveBeenCalledTimes(1);

    view.rerender(
      <EditSwipeableRow {...props} enabled={false}>
        <Child />
      </EditSwipeableRow>,
    );

    expect(onMount).toHaveBeenCalledTimes(1);
    expect(onUnmount).not.toHaveBeenCalled();
    expect(screen.getByTestId('swipeable').props.enabled).toBe(false);
    expect(screen.getAllByLabelText('Customer')).toHaveLength(2);
  });

  it('keeps delete as a custom action without making nested fields a button', () => {
    const onDelete = jest.fn();
    render(
      <EditSwipeableRow
        typography={typography}
        accessibilityLabel="Delete material"
        onDelete={onDelete}
      >
        <TextInput accessibilityLabel="Material description" />
      </EditSwipeableRow>,
    );

    expect(screen.getByLabelText('Material description')).toBeTruthy();
    expect(screen.getByLabelText('Delete material').props.accessibilityRole).toBeUndefined();

    fireEvent(screen.getByTestId('swipeable'), 'accessibilityAction', {
      nativeEvent: { actionName: 'delete' },
    });
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});
