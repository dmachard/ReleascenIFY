from releascenify.parser import ReleaseParser

class DebugParser(ReleaseParser):
    def parse(self, filename: str):
        result = super().parse(filename)
        return result

p = DebugParser()
res = p.parse('Asterix_-_1985_-_Asterix_Et_La_Surprise_De_Cesar_-_1080p.mkv')
print(res['group'])
