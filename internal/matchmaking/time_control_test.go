package matchmaking

import "testing"

func TestGetTimeControl(t *testing.T) {
	for _, name := range []string{"1+0", "3+2", "10+5", "30+20"} {
		if got, err := GetTimeControl(name); err != nil || got.Name != name {
			t.Errorf("GetTimeControl(%q) = %#v, %v", name, got, err)
		}
	}
	for _, name := range []string{"", "5+3", "3+3", "unknown"} {
		if _, err := GetTimeControl(name); err == nil {
			t.Errorf("GetTimeControl(%q) unexpectedly succeeded", name)
		}
	}
}
