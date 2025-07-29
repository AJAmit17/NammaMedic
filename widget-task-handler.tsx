import * as React from 'react';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { StepsWidget, HydrationWidget } from './components/widgets';
import { getStepsDataForWidget, getHydrationDataForWidget } from './lib/WidgetDataService';

const nameToWidget = {
    Steps: StepsWidget,
    Hydration: HydrationWidget,
};

export async function widgetTaskHandler(props: WidgetTaskHandlerProps): Promise<void> {
    const widgetInfo = props.widgetInfo;
    const Widget = nameToWidget[widgetInfo.widgetName as keyof typeof nameToWidget];

    if (!Widget) {
        console.error(`Widget not found: ${widgetInfo.widgetName}`);
        props.renderWidget(React.createElement('div', {}, `Widget ${widgetInfo.widgetName} not found`));
        return;
    }

    console.log(`Handling widget action: ${props.widgetAction} for ${widgetInfo.widgetName}`);

    try {
        await renderWidgetWithData(props, Widget, widgetInfo.widgetName);
    } catch (error) {
        console.error('Error in widgetTaskHandler:', error);
        // Fallback: render widget with default props
        props.renderWidget(React.createElement(Widget, {}));
    }
}

async function renderWidgetWithData(
    props: WidgetTaskHandlerProps, 
    Widget: any, 
    widgetName: string
) {
    try {
        console.log(`Rendering widget: ${widgetName}`);
        
        if (widgetName === 'Steps') {
            const stepsData = await getStepsDataForWidget();
            console.log(`Steps widget data:`, stepsData);
            props.renderWidget(
                React.createElement(Widget, {
                    steps: stepsData.steps,
                    goal: stepsData.goal,
                })
            );
        } else if (widgetName === 'Hydration') {
            const hydrationData = await getHydrationDataForWidget();
            console.log(`Hydration widget data:`, hydrationData);
            props.renderWidget(
                React.createElement(Widget, {
                    intake: hydrationData.intake,
                    goal: hydrationData.goal,
                })
            );
        } else {
            // Default widgets (like Hello)
            props.renderWidget(React.createElement(Widget, {}));
        }
        
        console.log(`Widget rendered successfully: ${widgetName}`);
    } catch (error) {
        console.error(`Error rendering widget ${widgetName}:`, error);
        // Render widget with default data on error
        if (widgetName === 'Steps') {
            console.log('Rendering Steps widget with default data');
            props.renderWidget(
                React.createElement(Widget, {
                    steps: 0,
                    goal: 10000,
                })
            );
        } else if (widgetName === 'Hydration') {
            console.log('Rendering Hydration widget with default data');
            props.renderWidget(
                React.createElement(Widget, {
                    intake: 0,
                    goal: 2500,
                })
            );
        } else {
            props.renderWidget(React.createElement(Widget, {}));
        }
    }
}
