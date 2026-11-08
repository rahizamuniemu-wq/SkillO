package handlers

import "testing"

func TestMissingSkillsNormalizesAndMatchesAliases(t *testing.T) {
	tests := []struct {
		name     string
		required []string
		worker   string
		want     []string
	}{
		{
			name:     "case and slash separated skills",
			required: []string{"HTML/ React"},
			worker:   "react, CSS",
			want:     nil,
		},
		{
			name:     "javascript alias",
			required: []string{"JavaScript"},
			worker:   "js",
			want:     nil,
		},
		{
			name:     "reactjs alias",
			required: []string{"React"},
			worker:   "ReactJS",
			want:     nil,
		},
		{
			name:     "missing domain",
			required: []string{"Python", "React"},
			worker:   "JavaScript",
			want:     []string{"Python", "React"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := missingSkills(tt.required, tt.worker)
			if len(got) != len(tt.want) {
				t.Fatalf("missingSkills() = %#v, want %#v", got, tt.want)
			}
			for i := range got {
				if got[i] != tt.want[i] {
					t.Fatalf("missingSkills() = %#v, want %#v", got, tt.want)
				}
			}
		})
	}
}
