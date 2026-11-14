# Regional labor cost inputs

The runtime CSV uses the hourly quartile/median columns in O*NET OnLine’s downloadable BLS May 2025 wage tables. Snapshot retrieved November 13, 2026. The 93 tables cover general maintenance in 50 states and DC, plus seven selected trades in CA, GA, IL, MA, TX and WA. Identical area/occupation keys across releases for adjoining states are counted once; rows with suppressed or unavailable quartiles are omitted. The output has 1,347 area/occupation rows, of which 573 concern general maintenance. Neither years of experience nor contractor retail margins are recorded. Sources: [BLS OEWS](https://www.bls.gov/oes/tables.htm), [O*NET example](https://www.onetonline.org/link/localwages/49-9071.00?st=IL).

To retrieve the tables from O*NET and regenerate the CSV using Python 3.9+, run:

    python3 collect.py /tmp/onet-downloads /tmp/local-wages.csv

The cache contains source CSVs per SOC and state. The online export is a rolling series: for a refresh use a new cache, check the release year on O*NET, and update the dated evidence and example rows together. Job quote accuracy is evaluated against installed services or spending, never by calling these employee wage quartiles contractor prices.
