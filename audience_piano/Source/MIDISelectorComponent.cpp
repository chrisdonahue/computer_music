/*
  ==============================================================================

    MIDISelectorComponent.cpp
    Created: 8 Mar 2015 7:18:13pm
    Author:  Chris

  ==============================================================================
*/

#include "../JuceLibraryCode/JuceHeader.h"
#include "MIDISelectorComponent.h"

//==============================================================================
MIDISelectorComponent::MIDISelectorComponent(AudioDeviceManager& adm)
	: deviceManager(adm),
	lastInputIndex(0), isAddingFromMidiInput(false),
	keyboardComponent(keyboardState, MidiKeyboardComponent::horizontalKeyboard),
	midiLogListBoxModel(midiMessageList)
{
	setSize(500, 500);

	setOpaque(true);

	addAndMakeVisible(midiInputListLabel);
	midiInputListLabel.setText("MIDI Input:", dontSendNotification);
	midiInputListLabel.attachToComponent(&midiInputList, true);

	addAndMakeVisible(midiInputList);
	midiInputList.setTextWhenNoChoicesAvailable("No MIDI Inputs Enabled");
	const StringArray midiInputs(MidiInput::getDevices());
	midiInputList.addItemList(midiInputs, 1);
	midiInputList.addListener(this);

	// find the first enabled device and use that bu default
	for (int i = 0; i < midiInputs.size(); ++i)
	{
		if (deviceManager.isMidiInputEnabled(midiInputs[i]))
		{
			setMidiInput(i);
			break;
		}
	}

	// if no enabled devices were found just use the first one in the list
	if (midiInputList.getSelectedId() == 0)
		setMidiInput(0);

	addAndMakeVisible(keyboardComponent);
	keyboardState.addListener(this);

	addAndMakeVisible(messageListBox);
	messageListBox.setModel(&midiLogListBoxModel);
	messageListBox.setColour(ListBox::backgroundColourId, Colour(0x32ffffff));
	messageListBox.setColour(ListBox::outlineColourId, Colours::black);
}

MIDISelectorComponent::~MIDISelectorComponent()
{
	keyboardState.removeListener(this);
	deviceManager.removeMidiInputCallback(MidiInput::getDevices()[midiInputList.getSelectedItemIndex()], this);
	midiInputList.removeListener(this);
}

void MIDISelectorComponent::paint (Graphics& g)
{
	g;
	//fillTiledBackground(g);
}

void MIDISelectorComponent::resized()
{
	Rectangle<int> area(getLocalBounds());
	midiInputList.setBounds(area.removeFromTop(36).removeFromRight(getWidth() - 150).reduced(8));
	keyboardComponent.setBounds(area.removeFromTop(80).reduced(8));
	messageListBox.setBounds(area.reduced(8));
}
