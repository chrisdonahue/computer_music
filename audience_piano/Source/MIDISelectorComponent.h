/*
  ==============================================================================

    MIDISelectorComponent.h
    Created: 8 Mar 2015 7:18:13pm
    Author:  Chris

  ==============================================================================
*/

#ifndef MIDISELECTORCOMPONENT_H_INCLUDED
#define MIDISELECTORCOMPONENT_H_INCLUDED

#include "../JuceLibraryCode/JuceHeader.h"

static String getMidiMessageDescription(const MidiMessage& m)
{
	if (m.isNoteOn())           return "Note on " + MidiMessage::getMidiNoteName(m.getNoteNumber(), true, true, 3);
	if (m.isNoteOff())          return "Note off " + MidiMessage::getMidiNoteName(m.getNoteNumber(), true, true, 3);
	if (m.isProgramChange())    return "Program change " + String(m.getProgramChangeNumber());
	if (m.isPitchWheel())       return "Pitch wheel " + String(m.getPitchWheelValue());
	if (m.isAftertouch())       return "After touch " + MidiMessage::getMidiNoteName(m.getNoteNumber(), true, true, 3) + ": " + String(m.getAfterTouchValue());
	if (m.isChannelPressure())  return "Channel pressure " + String(m.getChannelPressureValue());
	if (m.isAllNotesOff())      return "All notes off";
	if (m.isAllSoundOff())      return "All sound off";
	if (m.isMetaEvent())        return "Meta event";

	if (m.isController())
	{
		String name(MidiMessage::getControllerName(m.getControllerNumber()));

		if (name.isEmpty())
			name = "[" + String(m.getControllerNumber()) + "]";

		return "Controler " + name + ": " + String(m.getControllerValue());
	}

	return String::toHexString(m.getRawData(), m.getRawDataSize());
}

//==============================================================================
/** Simple list box that just displays a StringArray. */
class MidiLogListBoxModel : public ListBoxModel
{
public:
	MidiLogListBoxModel(const Array<MidiMessage>& list)
		: midiMessageList(list)
	{
	}

	int getNumRows() override    { return midiMessageList.size(); }

	void paintListBoxItem(int row, Graphics& g, int width, int height, bool rowIsSelected) override
	{
		if (rowIsSelected)
			g.fillAll(Colours::blue.withAlpha(0.2f));

		if (isPositiveAndBelow(row, midiMessageList.size()))
		{
			g.setColour(Colours::black);

			const MidiMessage& message = midiMessageList.getReference(row);
			double time = message.getTimeStamp();

			g.drawText(String::formatted("%02d:%02d:%02d",
				((int)(time / 3600.0)) % 24,
				((int)(time / 60.0)) % 60,
				((int)time) % 60)
				+ "  -  " + getMidiMessageDescription(message),
				Rectangle<int>(width, height).reduced(4, 0),
				Justification::centredLeft, true);
		}
	}

private:
	const Array<MidiMessage>& midiMessageList;

	JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(MidiLogListBoxModel)
};

//==============================================================================

class MIDISelectorComponent :
	public Component,
	private ComboBox::Listener,
	private MidiInputCallback,
	private MidiKeyboardStateListener,
	private AsyncUpdater
{
public:
    MIDISelectorComponent(AudioDeviceManager& adm);
    ~MIDISelectorComponent();

    void paint (Graphics&);
    void resized();

private:
	AudioDeviceManager& deviceManager;
	ComboBox midiInputList;
	Label midiInputListLabel;
	int lastInputIndex;
	bool isAddingFromMidiInput;

	MidiKeyboardState keyboardState;
	MidiKeyboardComponent keyboardComponent;

	ListBox messageListBox;
	Array<MidiMessage> midiMessageList;
	MidiLogListBoxModel midiLogListBoxModel;

	//==============================================================================
	/** Starts listening to a MIDI input device, enabling it if necessary. */
	void setMidiInput(int index)
	{
		const StringArray list(MidiInput::getDevices());

		deviceManager.removeMidiInputCallback(list[lastInputIndex], this);

		const String newInput(list[index]);

		if (!deviceManager.isMidiInputEnabled(newInput))
			deviceManager.setMidiInputEnabled(newInput, true);

		deviceManager.addMidiInputCallback(newInput, this);
		midiInputList.setSelectedId(index + 1, dontSendNotification);

		lastInputIndex = index;
	}

	void comboBoxChanged(ComboBox* box) override
	{
		if (box == &midiInputList)
			setMidiInput(midiInputList.getSelectedItemIndex());
	}

	// These methods handle callbacks from the midi device + on-screen keyboard..
	void handleIncomingMidiMessage(MidiInput*, const MidiMessage& message) override
	{
		const ScopedValueSetter<bool> scopedInputFlag(isAddingFromMidiInput, true);
		keyboardState.processNextMidiEvent(message);
		postMessageToList(message);
	}

	void handleNoteOn(MidiKeyboardState*, int midiChannel, int midiNoteNumber, float velocity) override
	{
		if (!isAddingFromMidiInput)
		{
			MidiMessage m(MidiMessage::noteOn(midiChannel, midiNoteNumber, velocity));
			m.setTimeStamp(Time::getMillisecondCounterHiRes() * 0.001);
			postMessageToList(m);
		}
	}

	void handleNoteOff(MidiKeyboardState*, int midiChannel, int midiNoteNumber) override
	{
		if (!isAddingFromMidiInput)
		{
			MidiMessage m(MidiMessage::noteOff(midiChannel, midiNoteNumber));
			m.setTimeStamp(Time::getMillisecondCounterHiRes() * 0.001);
			postMessageToList(m);
		}
	}

	// This is used to dispach an incoming message to the message thread
	/*
	struct IncomingMessageCallback : public CallbackMessage
	{
		IncomingMessageCallback(MidiDemo* d, const MidiMessage& m)
			: demo(d), message(m) {}

		void messageCallback() override
		{
			if (demo != nullptr)
				demo->addMessageToList(message);
		}

		Component::SafePointer<MidiDemo> demo;
		MidiMessage message;
	};
	*/

	void postMessageToList(const MidiMessage& message)
	{
		message;
		//(new IncomingMessageCallback(this, message))->post();
	}

	void addMessageToList(const MidiMessage& message)
	{
		midiMessageList.add(message);
		triggerAsyncUpdate();
	}

	void handleAsyncUpdate() override
	{
		messageListBox.updateContent();
		messageListBox.scrollToEnsureRowIsOnscreen(midiMessageList.size() - 1);
		messageListBox.repaint();
	}

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (MIDISelectorComponent)
};


#endif  // MIDISELECTORCOMPONENT_H_INCLUDED
